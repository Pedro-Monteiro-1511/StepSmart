import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { CharacterService } from '../character/character.service';
import { MANDATORY_TEMPLATE, OPTIONAL_TEMPLATES } from './challenge-templates';
import { dateKeyToDateColumn, localDateKey, localDayBoundsUtc, localTimeOfDayUtc } from '../common/time.util';
import { ECONOMY } from '@stepsmart/game-config';

type Tx = Prisma.TransactionClient;

@Injectable()
export class ChallengesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly characterService: CharacterService,
  ) {}

  async getToday(userId: string, timezone: string) {
    const dateKey = localDateKey(new Date(), timezone);
    await this.ensureTodayChallenges(userId, timezone, dateKey);
    return this.prisma.userDailyChallenge.findMany({
      where: { userId, date: dateKeyToDateColumn(dateKey) },
      include: { dailyChallenge: true },
      orderBy: { dailyChallenge: { isMandatory: 'desc' } },
    });
  }

  /** Idempotent: safe to call on every request. Generates the shared day pool once, then each user's instances. */
  async ensureTodayChallenges(userId: string, timezone: string, dateKey?: string) {
    const key = dateKey ?? localDateKey(new Date(), timezone);
    const dateColumn = dateKeyToDateColumn(key);

    const existingForUser = await this.prisma.userDailyChallenge.count({
      where: { userId, date: dateColumn },
    });
    if (existingForUser >= ECONOMY.CHALLENGES_PER_DAY) {
      return;
    }

    let dayPool = await this.prisma.dailyChallenge.findMany({ where: { date: dateColumn } });
    if (dayPool.length === 0) {
      dayPool = await this.generateDayPool(dateColumn);
    }

    const personalBest = await this.getPersonalBestSteps(userId);

    await this.prisma.$transaction(
      dayPool.map((dc) =>
        this.prisma.userDailyChallenge.upsert({
          where: { userId_dailyChallengeId: { userId, dailyChallengeId: dc.id } },
          create: {
            userId,
            dailyChallengeId: dc.id,
            date: dateColumn,
            target: this.resolveTargetForUser(dc.challengeType, dc.params as Record<string, unknown>, personalBest),
          },
          update: {},
        }),
      ),
    );
  }

  private resolveTargetForUser(
    challengeType: string,
    params: Record<string, unknown>,
    personalBest: number,
  ): number {
    if (challengeType === 'beat_pr') {
      return Math.max(personalBest, 1000);
    }
    return (params.target as number) ?? 0;
  }

  private async getPersonalBestSteps(userId: string): Promise<number> {
    const best = await this.prisma.dailyStepCredit.aggregate({
      where: { userId },
      _max: { creditedSteps: true },
    });
    return best._max.creditedSteps ?? 0;
  }

  private async generateDayPool(dateColumn: Date) {
    const shuffled = [...OPTIONAL_TEMPLATES].sort(() => Math.random() - 0.5);
    const chosen = [MANDATORY_TEMPLATE, ...shuffled.slice(0, ECONOMY.CHALLENGES_PER_DAY - 1)];

    return this.prisma.$transaction(
      chosen.map((tpl) =>
        this.prisma.dailyChallenge.create({
          data: {
            date: dateColumn,
            challengeType: tpl.challengeType,
            title: tpl.title,
            params: tpl.paramsFactory() as Prisma.InputJsonValue,
            isMandatory: tpl.isMandatory,
            rewardPayload: tpl.rewardFactory('normal') as Prisma.InputJsonValue,
          },
        }),
      ),
    );
  }

  /**
   * Called from inside the /steps/sync transaction so challenge progress stays in
   * lockstep with the step credit that caused it. `stepsToday` is the already-capped
   * total for the day; window-scoped challenges re-query StepLog for their specific range.
   */
  async evaluateOnStepSync(
    tx: Tx,
    userId: string,
    dateKey: string,
    timezone: string,
    stepsToday: number,
    currentStreak: number,
  ) {
    const dateColumn = dateKeyToDateColumn(dateKey);
    const active = await tx.userDailyChallenge.findMany({
      where: { userId, date: dateColumn, status: 'ACTIVE' },
      include: { dailyChallenge: true },
    });

    const now = new Date();

    for (const udc of active) {
      const params = udc.dailyChallenge.params as Record<string, unknown>;
      let progress = udc.progress;
      let deadlinePassed = false;

      switch (udc.dailyChallenge.challengeType) {
        case 'daily_steps': {
          progress = Math.min(stepsToday, udc.target);
          break;
        }
        case 'timed_steps':
        case 'early_bird': {
          // Steps must happen *before* the deadline — using the whole day's total would let a user
          // complete "3000 steps by 12:00" with steps taken at 8pm, so we bound the window explicitly.
          const dayStart = localDayBoundsUtc(dateKey, timezone).start;
          const deadline = localTimeOfDayUtc(dateKey, timezone, params.deadline as string);
          const windowSteps = await this.sumStepsInRange(tx, userId, dayStart, deadline);
          progress = Math.min(windowSteps, udc.target);
          deadlinePassed = now > deadline;
          break;
        }
        case 'time_window': {
          const { start, end } = this.resolveWindow(dateKey, timezone, params);
          const windowSteps = await this.sumStepsInRange(tx, userId, start, end);
          progress = Math.min(windowSteps, udc.target);
          deadlinePassed = now > end;
          break;
        }
        case 'streak': {
          progress = Math.min(currentStreak, udc.target);
          break;
        }
        case 'beat_pr': {
          progress = stepsToday;
          break;
        }
        default:
          continue; // multi_period / consistency / clan_contribution / flawless: future phases
      }

      const completed = progress >= udc.target;
      const failed = !completed && deadlinePassed;

      if (progress === udc.progress && !completed && !failed) {
        continue;
      }

      await tx.userDailyChallenge.update({
        where: { id: udc.id },
        data: {
          progress,
          status: completed ? 'COMPLETED' : failed ? 'FAILED' : 'ACTIVE',
          completedAt: completed ? now : undefined,
        },
      });
    }
  }

  private resolveWindow(dateKey: string, timezone: string, params: Record<string, unknown>) {
    if (params.windowStart && params.windowEnd) {
      return {
        start: localTimeOfDayUtc(dateKey, timezone, params.windowStart as string),
        end: localTimeOfDayUtc(dateKey, timezone, params.windowEnd as string),
      };
    }
    return localDayBoundsUtc(dateKey, timezone);
  }

  private async sumStepsInRange(tx: Tx, userId: string, start: Date, end: Date): Promise<number> {
    const result = await tx.stepLog.aggregate({
      where: { userId, isManual: false, bucketStart: { gte: start, lt: end } },
      _sum: { steps: true },
    });
    return result._sum.steps ?? 0;
  }

  async claim(userId: string, userDailyChallengeId: string) {
    return this.prisma.$transaction(async (tx) => {
      const udc = await tx.userDailyChallenge.findUnique({
        where: { id: userDailyChallengeId },
        include: { dailyChallenge: true },
      });
      if (!udc || udc.userId !== userId) {
        throw new NotFoundException('Challenge not found');
      }
      if (udc.status !== 'COMPLETED') {
        throw new BadRequestException('Challenge is not completed yet');
      }
      if (udc.rewardClaimed) {
        throw new BadRequestException('Reward already claimed');
      }

      const reward = udc.dailyChallenge.rewardPayload as { xp: number; coins: number };

      if (reward.coins > 0) {
        await this.walletService.applyLedgerEntry(
          tx,
          userId,
          reward.coins,
          TransactionType.REWARD,
          'daily_challenge',
          udc.id,
        );
      }
      if (reward.xp > 0) {
        await this.characterService.creditXp(tx, userId, reward.xp, 'challenge', udc.id);
      }

      await tx.userDailyChallenge.update({
        where: { id: udc.id },
        data: { rewardClaimed: true },
      });

      return { claimed: true, reward };
    });
  }

  /** Cron entry point: generates today's 3 challenges for every active user. Fine at MVP scale;
   *  batch/queue this per-timezone if the user base grows large. */
  async generateForAllActiveUsers() {
    const users = await this.prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, timezone: true },
    });
    for (const user of users) {
      await this.ensureTodayChallenges(user.id, user.timezone);
    }
  }

  /** Cron entry point: fails ACTIVE challenges whose local deadline/window has passed
   *  without a step sync happening to catch it (closeDayAndStreaks job from the plan). */
  async failExpiredActiveChallenges() {
    const candidates = await this.prisma.userDailyChallenge.findMany({
      where: {
        status: 'ACTIVE',
        dailyChallenge: { challengeType: { in: ['timed_steps', 'early_bird', 'time_window'] } },
      },
      include: { dailyChallenge: true, user: { select: { timezone: true } } },
    });

    const now = new Date();
    for (const udc of candidates) {
      const params = udc.dailyChallenge.params as Record<string, unknown>;
      const dateKey = udc.date.toISOString().slice(0, 10);
      const deadlineStr = (params.deadline as string) ?? (params.windowEnd as string);
      if (!deadlineStr) continue;

      const deadline = localTimeOfDayUtc(dateKey, udc.user.timezone, deadlineStr);
      if (now > deadline) {
        await this.prisma.userDailyChallenge.update({ where: { id: udc.id }, data: { status: 'FAILED' } });
      }
    }
  }
}
