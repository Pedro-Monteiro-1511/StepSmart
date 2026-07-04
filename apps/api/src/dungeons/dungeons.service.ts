import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DungeonResult, Prisma, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { CharacterService } from '../character/character.service';
import { combatPower, dungeonWinChance, extraAttemptCost, maxDungeonAttempts, DUNGEON } from '@stepsmart/game-config';
import { generateCombatLog } from './combat-log';
import { dateKeyToDateColumn, localDateKey } from '../common/time.util';

type Tx = Prisma.TransactionClient;

@Injectable()
export class DungeonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly characterService: CharacterService,
  ) {}

  async getCatalog(userId: string) {
    const character = await this.prisma.character.findUniqueOrThrow({ where: { userId } });
    return this.prisma.dungeon.findMany({
      where: { isActive: true, minLevel: { lte: character.level } },
      orderBy: { difficulty: 'asc' },
    });
  }

  async getState(userId: string, timezone: string) {
    return this.prisma.$transaction((tx) => this.ensureRegeneratedState(tx, userId, timezone));
  }

  async listRuns(userId: string, take = 20) {
    return this.prisma.dungeonRun.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
      include: { dungeon: true },
    });
  }

  async enter(userId: string, timezone: string, dungeonId: string) {
    return this.prisma.$transaction(async (tx) => {
      const dungeon = await tx.dungeon.findUnique({ where: { id: dungeonId } });
      if (!dungeon || !dungeon.isActive) {
        throw new NotFoundException('Dungeon not found');
      }

      const character = await tx.character.findUniqueOrThrow({ where: { userId } });
      if (character.level < dungeon.minLevel) {
        throw new BadRequestException(`Requires level ${dungeon.minLevel}`);
      }

      const state = await this.ensureRegeneratedState(tx, userId, timezone);
      if (state.attemptsAvailable <= 0) {
        throw new BadRequestException('No dungeon attempts available');
      }

      await tx.userDungeonState.update({
        where: { userId },
        data: { attemptsAvailable: { decrement: 1 } },
      });

      const characterSummary = await this.characterService.getSummaryTx(tx, userId);
      const power = combatPower(characterSummary.stats);
      const winChance = dungeonWinChance(power, dungeon.difficulty);
      const result: 'WIN' | 'LOSE' = Math.random() < winChance ? 'WIN' : 'LOSE';
      const combatLog = generateCombatLog(dungeon.name, characterSummary.stats, result);

      let xpGained = dungeon.xpRewardLose;
      let coinsGained = 0;
      let lootItemId: string | null = null;

      if (result === 'WIN') {
        xpGained = dungeon.xpRewardWin;
        coinsGained = dungeon.coinsRewardWin;
        lootItemId = await this.rollLoot(tx, dungeon.lootTable as { itemKey: string; weight: number }[], characterSummary.stats.luck);
      }

      if (coinsGained > 0) {
        await this.walletService.applyLedgerEntry(
          tx,
          userId,
          coinsGained,
          TransactionType.REWARD,
          'dungeon',
          dungeon.id,
        );
      }
      if (xpGained > 0) {
        await this.characterService.creditXp(tx, userId, xpGained, 'dungeon', dungeon.id);
      }

      if (lootItemId) {
        await tx.inventory.upsert({
          where: { userId_itemId: { userId, itemId: lootItemId } },
          create: { userId, itemId: lootItemId, quantity: 1 },
          update: { quantity: { increment: 1 } },
        });
      }

      const run = await tx.dungeonRun.create({
        data: {
          userId,
          dungeonId: dungeon.id,
          result: result === 'WIN' ? DungeonResult.WIN : DungeonResult.LOSE,
          combatLog,
          xpGained,
          coinsGained,
          lootItemId,
        },
      });

      const lootItem = lootItemId ? await tx.item.findUnique({ where: { id: lootItemId } }) : null;
      const finalState = await tx.userDungeonState.findUniqueOrThrow({ where: { userId } });

      return { run, lootItem, attemptsAvailable: finalState.attemptsAvailable };
    });
  }

  async buyAttempt(userId: string, timezone: string) {
    return this.prisma.$transaction(async (tx) => {
      const state = await this.ensureRegeneratedState(tx, userId, timezone);
      const cost = extraAttemptCost(state.extraAttemptsBoughtToday);

      await this.walletService.applyLedgerEntry(tx, userId, -cost, TransactionType.PURCHASE, 'dungeon_attempt');

      const updated = await tx.userDungeonState.update({
        where: { userId },
        data: {
          attemptsAvailable: { increment: 1 },
          extraAttemptsBoughtToday: { increment: 1 },
        },
      });

      return { attemptsAvailable: updated.attemptsAvailable, costPaid: cost };
    });
  }

  /** Ensures a UserDungeonState row exists, regenerates attempts based on elapsed time, and
   *  resets the daily extra-purchase counter when the calendar day (in the user's tz) rolls over. */
  private async ensureRegeneratedState(tx: Tx, userId: string, timezone: string) {
    const character = await tx.character.findUniqueOrThrow({ where: { userId }, include: { stats: true } });
    const staminaLevel = character.stats.find((s) => s.skillKey === 'stamina')?.level ?? 1;
    const maxAttempts = maxDungeonAttempts(staminaLevel);
    const dateKey = localDateKey(new Date(), timezone);
    const todayColumn = dateKeyToDateColumn(dateKey);

    let state = await tx.userDungeonState.findUnique({ where: { userId } });
    if (!state) {
      state = await tx.userDungeonState.create({
        data: { userId, attemptsAvailable: maxAttempts, maxAttempts, date: todayColumn },
      });
    }

    const isNewDay = state.date.getTime() !== todayColumn.getTime();
    const now = new Date();
    const minutesElapsed = (now.getTime() - state.lastRegenAt.getTime()) / 60_000;
    const regenerated = Math.floor(minutesElapsed / DUNGEON.ATTEMPT_REGEN_MINUTES);

    let attemptsAvailable = state.attemptsAvailable;
    let lastRegenAt = state.lastRegenAt;

    if (regenerated > 0) {
      attemptsAvailable = Math.min(maxAttempts, attemptsAvailable + regenerated);
      lastRegenAt = new Date(state.lastRegenAt.getTime() + regenerated * DUNGEON.ATTEMPT_REGEN_MINUTES * 60_000);
    }

    if (
      isNewDay ||
      regenerated > 0 ||
      state.maxAttempts !== maxAttempts ||
      attemptsAvailable !== state.attemptsAvailable
    ) {
      state = await tx.userDungeonState.update({
        where: { userId },
        data: {
          attemptsAvailable,
          maxAttempts,
          lastRegenAt,
          date: todayColumn,
          extraAttemptsBoughtToday: isNewDay ? 0 : state.extraAttemptsBoughtToday,
        },
      });
    }

    return state;
  }

  private async rollLoot(
    tx: Tx,
    lootTable: { itemKey: string; weight: number }[],
    luckLevel: number,
  ): Promise<string | null> {
    const dropChance = Math.min(0.95, 0.5 + luckLevel * 0.03);
    if (Math.random() >= dropChance || lootTable.length === 0) {
      return null;
    }

    const totalWeight = lootTable.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * totalWeight;
    const chosen = lootTable.find((entry) => {
      roll -= entry.weight;
      return roll <= 0;
    });
    if (!chosen) return null;

    const item = await tx.item.findUnique({ where: { key: chosen.itemKey } });
    return item?.id ?? null;
  }
}
