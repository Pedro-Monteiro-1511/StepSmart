import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TavernQuestStatus, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { CharacterService } from '../character/character.service';
import { TAVERN } from '@stepsmart/game-config';

type Tx = Prisma.TransactionClient;

@Injectable()
export class TavernService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly characterService: CharacterService,
  ) {}

  /** Returns the 3 quests "on offer" for the current rotation window, plus the user's active/completed quest (if any). */
  async getQuests(userId: string) {
    const character = await this.prisma.character.findUniqueOrThrow({ where: { userId } });
    const catalog = await this.prisma.tavernQuest.findMany({
      where: { isActive: true, minLevel: { lte: character.level } },
    });
    const offered = this.pickRotation(catalog);

    let current = await this.prisma.userTavernQuest.findFirst({
      where: { userId, status: { in: [TavernQuestStatus.IN_PROGRESS, TavernQuestStatus.COMPLETED] } },
      include: { tavernQuest: true },
      orderBy: { startedAt: 'desc' },
    });

    if (current && current.status === TavernQuestStatus.IN_PROGRESS && new Date() >= current.endsAt) {
      current = await this.prisma.$transaction((tx) => this.resolveQuest(tx, current!.id));
    }

    return { offered, current };
  }

  /** Deterministic per-time-window selection so everyone sees the same "3 on offer" until the next refresh. */
  private pickRotation<T>(catalog: T[]): T[] {
    if (catalog.length <= TAVERN.QUEST_SLOTS) return catalog;
    const epoch = Math.floor(Date.now() / (TAVERN.QUEST_REFRESH_HOURS * 60 * 60 * 1000));
    let seed = epoch;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const shuffled = [...catalog].sort(() => rand() - 0.5);
    return shuffled.slice(0, TAVERN.QUEST_SLOTS);
  }

  async start(userId: string, tavernQuestId: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.userTavernQuest.findFirst({
        where: { userId, status: TavernQuestStatus.IN_PROGRESS },
      });
      if (existing) {
        throw new BadRequestException('Already have a tavern quest in progress');
      }

      const quest = await tx.tavernQuest.findUnique({ where: { id: tavernQuestId } });
      if (!quest || !quest.isActive) {
        throw new NotFoundException('Tavern quest not found');
      }

      const character = await tx.character.findUniqueOrThrow({ where: { userId } });
      if (character.level < quest.minLevel) {
        throw new BadRequestException(`Requires level ${quest.minLevel}`);
      }

      if (quest.costCoins > 0) {
        await this.walletService.applyLedgerEntry(
          tx,
          userId,
          -quest.costCoins,
          TransactionType.PURCHASE,
          'tavern_quest',
          quest.id,
        );
      }

      const startedAt = new Date();
      const endsAt = new Date(startedAt.getTime() + quest.durationMinutes * 60_000);

      return tx.userTavernQuest.create({
        data: { userId, tavernQuestId: quest.id, startedAt, endsAt },
        include: { tavernQuest: true },
      });
    });
  }

  async claim(userId: string, userTavernQuestId: string) {
    return this.prisma.$transaction(async (tx) => {
      let userQuest = await tx.userTavernQuest.findUnique({
        where: { id: userTavernQuestId },
        include: { tavernQuest: true },
      });
      if (!userQuest || userQuest.userId !== userId) {
        throw new NotFoundException('Tavern quest not found');
      }

      if (userQuest.status === TavernQuestStatus.IN_PROGRESS) {
        if (new Date() < userQuest.endsAt) {
          throw new BadRequestException('Quest is still in progress');
        }
        userQuest = await this.resolveQuest(tx, userQuest.id);
      }

      if (userQuest.status === TavernQuestStatus.CLAIMED) {
        throw new BadRequestException('Reward already claimed');
      }

      const reward = userQuest.tavernQuest.rewardPayload as { xp: number; coins: number };

      if (reward.coins > 0) {
        await this.walletService.applyLedgerEntry(
          tx,
          userId,
          reward.coins,
          TransactionType.REWARD,
          'tavern_quest',
          userQuest.id,
        );
      }
      if (reward.xp > 0) {
        await this.characterService.creditXp(tx, userId, reward.xp, 'tavern', userQuest.id);
      }

      return tx.userTavernQuest.update({
        where: { id: userQuest.id },
        data: { status: TavernQuestStatus.CLAIMED },
        include: { tavernQuest: true },
      });
    });
  }

  /** Marks an IN_PROGRESS quest as COMPLETED once its timer has elapsed, with a short result narrative. */
  async resolveQuest(tx: Tx, userTavernQuestId: string) {
    const userQuest = await tx.userTavernQuest.findUniqueOrThrow({
      where: { id: userTavernQuestId },
      include: { tavernQuest: true },
    });

    return tx.userTavernQuest.update({
      where: { id: userTavernQuestId },
      data: {
        status: TavernQuestStatus.COMPLETED,
        resultPayload: { narrative: `O teu personagem regressou de "${userQuest.tavernQuest.title}".` },
      },
      include: { tavernQuest: true },
    });
  }

  /** Cron entry point: resolves every IN_PROGRESS quest across all users whose timer has elapsed. */
  async resolveDueQuestsForAllUsers() {
    const due = await this.prisma.userTavernQuest.findMany({
      where: { status: TavernQuestStatus.IN_PROGRESS, endsAt: { lte: new Date() } },
      select: { id: true },
    });
    for (const { id } of due) {
      await this.prisma.$transaction((tx) => this.resolveQuest(tx, id));
    }
  }
}
