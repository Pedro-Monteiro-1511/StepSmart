import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { resolveLevelFromXp, skillUpgradeCost, SkillKey, SKILL_KEYS, ECONOMY } from '@stepsmart/game-config';
import type { CharacterSummary, EquippedItemSummary, ShopItemSummary } from '@stepsmart/shared-types';

type Tx = Prisma.TransactionClient;
type DbClient = Tx | PrismaService;

@Injectable()
export class CharacterService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(userId: string): Promise<CharacterSummary> {
    const character = await this.prisma.character.findUnique({
      where: { userId },
      include: { stats: true },
    });
    if (!character) {
      throw new NotFoundException('Character not found');
    }
    return this.toSummary(this.prisma, character);
  }

  /** Same as getSummary but reads through an existing transaction client (e.g. from steps sync). */
  async getSummaryTx(tx: Tx, userId: string): Promise<CharacterSummary> {
    const character = await tx.character.findUniqueOrThrow({
      where: { userId },
      include: { stats: true },
    });
    return this.toSummary(tx, character);
  }

  private async toSummary(
    db: DbClient,
    character: {
      id: string;
      name: string;
      xp: number;
      skillPoints: number;
      equipped: Prisma.JsonValue;
      stats: { skillKey: string; level: number }[];
    },
  ): Promise<CharacterSummary> {
    const { level, xpIntoLevel, xpToNext } = resolveLevelFromXp(character.xp);
    const stats = Object.fromEntries(
      SKILL_KEYS.map((key) => [key, character.stats.find((s) => s.skillKey === key)?.level ?? 1]),
    ) as Record<SkillKey, number>;

    const equippedIds = (character.equipped ?? {}) as Record<string, string>;
    const inventoryIds = Object.values(equippedIds).filter(Boolean);
    const equippedInventory = inventoryIds.length
      ? await db.inventory.findMany({ where: { id: { in: inventoryIds } }, include: { item: true } })
      : [];

    const equipped: Record<string, EquippedItemSummary> = {};
    for (const [slot, inventoryId] of Object.entries(equippedIds)) {
      const entry = equippedInventory.find((e) => e.id === inventoryId);
      if (entry) {
        equipped[slot] = { inventoryId: entry.id, item: entry.item as unknown as ShopItemSummary };
      }
    }

    return {
      id: character.id,
      name: character.name,
      level,
      xp: xpIntoLevel,
      xpToNext,
      skillPoints: character.skillPoints,
      stats,
      equipped,
    };
  }

  /**
   * Credits XP to a character inside an existing transaction (so it stays atomic with
   * whatever caused the XP — step sync, challenge completion, etc). Awards skill points
   * on every level gained. Returns the level before/after for logging.
   */
  async creditXp(
    tx: Tx,
    userId: string,
    amount: number,
    source: string,
    referenceId?: string,
  ): Promise<{ levelBefore: number; levelAfter: number }> {
    if (amount <= 0) {
      const character = await tx.character.findUniqueOrThrow({ where: { userId } });
      const { level } = resolveLevelFromXp(character.xp);
      return { levelBefore: level, levelAfter: level };
    }

    const character = await tx.character.findUniqueOrThrow({ where: { userId } });
    const before = resolveLevelFromXp(character.xp);
    const newXp = character.xp + amount;
    const after = resolveLevelFromXp(newXp);
    const levelsGained = after.level - before.level;

    await tx.character.update({
      where: { userId },
      data: {
        xp: newXp,
        level: after.level,
        skillPoints: { increment: levelsGained * ECONOMY.SKILL_POINTS_PER_LEVEL },
      },
    });

    await tx.xpLog.create({
      data: {
        userId,
        source,
        amount,
        referenceId,
        levelBefore: before.level,
        levelAfter: after.level,
      },
    });

    return { levelBefore: before.level, levelAfter: after.level };
  }

  async upgradeSkill(userId: string, skillKey: string) {
    if (!SKILL_KEYS.includes(skillKey as SkillKey)) {
      throw new BadRequestException(`Unknown skill: ${skillKey}`);
    }

    return this.prisma.$transaction(async (tx) => {
      const character = await tx.character.findUniqueOrThrow({ where: { userId }, include: { stats: true } });
      const stat = character.stats.find((s) => s.skillKey === skillKey);
      const currentLevel = stat?.level ?? 1;
      const cost = skillUpgradeCost(currentLevel);

      if (character.skillPoints < cost) {
        throw new BadRequestException(
          `Not enough skill points: need ${cost}, have ${character.skillPoints}`,
        );
      }

      await tx.character.update({
        where: { userId },
        data: { skillPoints: { decrement: cost } },
      });

      await tx.characterStat.upsert({
        where: { characterId_skillKey: { characterId: character.id, skillKey } },
        create: { characterId: character.id, skillKey, level: 2 },
        update: { level: { increment: 1 } },
      });

      const updated = await tx.character.findUniqueOrThrow({ where: { userId }, include: { stats: true } });
      return this.toSummary(tx, updated);
    });
  }
}
