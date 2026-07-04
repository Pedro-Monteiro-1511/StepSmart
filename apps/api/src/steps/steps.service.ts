import { Injectable } from '@nestjs/common';
import { Prisma, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { CharacterService } from '../character/character.service';
import { ChallengesService } from '../challenges/challenges.service';
import { LeaderboardsService } from '../leaderboards/leaderboards.service';
import { StepSyncDto } from './dto/step-sync.dto';
import { ECONOMY } from '@stepsmart/game-config';
import {
  dateKeyToDateColumn,
  localDateKey,
  localDayBoundsUtc,
  periodKeys,
  utcMonthBounds,
  utcWeekBounds,
} from '../common/time.util';

type Tx = Prisma.TransactionClient;

/** Physically implausible sustained cadence — clamp bucket steps above this instead of trusting the client. */
const MAX_STEPS_PER_MINUTE = 220;

@Injectable()
export class StepsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly characterService: CharacterService,
    private readonly challengesService: ChallengesService,
    private readonly leaderboardsService: LeaderboardsService,
  ) {}

  async sync(userId: string, timezone: string, dto: StepSyncDto) {
    // Must exist before we evaluate progress below — runs as its own small transaction since
    // Prisma's interactive tx client can't be nested inside the main sync transaction.
    await this.challengesService.ensureTodayChallenges(userId, timezone);

    const result = await this.prisma.$transaction(async (tx) => {
      for (const bucket of dto.buckets) {
        await this.upsertBucket(tx, userId, bucket, dto.clientBatchId);
      }

      const dateKey = localDateKey(new Date(), timezone);
      const { start, end } = localDayBoundsUtc(dateKey, timezone);

      const rawTotal = await this.sumNonManualSteps(tx, userId, start, end);
      const cappedTotal = Math.min(rawTotal, ECONOMY.DAILY_STEP_CAP);

      const creditRow = await tx.dailyStepCredit.upsert({
        where: { userId_date: { userId, date: dateKeyToDateColumn(dateKey) } },
        create: { userId, date: dateKeyToDateColumn(dateKey), creditedSteps: 0 },
        update: {},
      });

      const coinsTotal = Math.floor(cappedTotal / ECONOMY.STEPS_PER_COIN);
      const coinsAlreadyCredited = Math.floor(creditRow.creditedSteps / ECONOMY.STEPS_PER_COIN);
      const coinsToCredit = Math.max(0, coinsTotal - coinsAlreadyCredited);

      const xpTotal = Math.floor(cappedTotal * ECONOMY.XP_PER_STEP);
      const xpAlreadyCredited = Math.floor(creditRow.creditedSteps * ECONOMY.XP_PER_STEP);
      const xpToCredit = Math.max(0, xpTotal - xpAlreadyCredited);

      if (cappedTotal !== creditRow.creditedSteps) {
        await tx.dailyStepCredit.update({
          where: { userId_date: { userId, date: dateKeyToDateColumn(dateKey) } },
          data: { creditedSteps: cappedTotal },
        });
      }

      if (coinsToCredit > 0) {
        await this.walletService.applyLedgerEntry(
          tx,
          userId,
          coinsToCredit,
          TransactionType.STEP_CREDIT,
          'steps',
          dateKey,
          { stepsCredited: cappedTotal - creditRow.creditedSteps },
        );
      }
      if (xpToCredit > 0) {
        await this.characterService.creditXp(tx, userId, xpToCredit, 'steps', dateKey);
      }

      const currentStreak = await this.updateStreak(tx, userId, dateKey, cappedTotal);

      await this.challengesService.evaluateOnStepSync(tx, userId, dateKey, timezone, cappedTotal, currentStreak);

      const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });
      const rawCharacter = await tx.character.findUniqueOrThrow({ where: { userId } });
      const character = await this.characterService.getSummaryTx(tx, userId);
      const challenges = await tx.userDailyChallenge.findMany({
        where: { userId, date: dateKeyToDateColumn(dateKey) },
        include: { dailyChallenge: true },
      });

      const now = new Date();
      const weekBounds = utcWeekBounds(now);
      const monthBounds = utcMonthBounds(now);
      const [weeklySum, monthlySum, allTimeSum] = await Promise.all([
        tx.dailyStepCredit.aggregate({
          where: { userId, date: { gte: weekBounds.start, lt: weekBounds.end } },
          _sum: { creditedSteps: true },
        }),
        tx.dailyStepCredit.aggregate({
          where: { userId, date: { gte: monthBounds.start, lt: monthBounds.end } },
          _sum: { creditedSteps: true },
        }),
        tx.dailyStepCredit.aggregate({ where: { userId }, _sum: { creditedSteps: true } }),
      ]);

      return {
        stepsToday: cappedTotal,
        coinsCredited: coinsToCredit,
        xpCredited: xpToCredit,
        walletBalance: wallet.coinsBalance,
        character,
        challenges,
        leaderboardInputs: {
          periods: periodKeys(now, 'utc'),
          stepsDaily: cappedTotal,
          stepsWeekly: weeklySum._sum.creditedSteps ?? 0,
          stepsMonthly: monthlySum._sum.creditedSteps ?? 0,
          stepsAllTime: allTimeSum._sum.creditedSteps ?? 0,
          xpAllTime: rawCharacter.xp,
        },
      };
    });

    const { periods, stepsDaily, stepsWeekly, stepsMonthly, stepsAllTime, xpAllTime } = result.leaderboardInputs;
    await Promise.all([
      this.leaderboardsService.setScore('individual', 'steps', 'daily', periods.daily, userId, stepsDaily),
      this.leaderboardsService.setScore('individual', 'steps', 'weekly', periods.weekly, userId, stepsWeekly),
      this.leaderboardsService.setScore('individual', 'steps', 'monthly', periods.monthly, userId, stepsMonthly),
      this.leaderboardsService.setScore('individual', 'steps', 'all_time', 'all', userId, stepsAllTime),
      this.leaderboardsService.setScore('individual', 'xp', 'all_time', 'all', userId, xpAllTime),
    ]);

    const { leaderboardInputs: _leaderboardInputs, ...publicResult } = result;
    return publicResult;
  }

  async getToday(userId: string, timezone: string) {
    const dateKey = localDateKey(new Date(), timezone);
    const { start, end } = localDayBoundsUtc(dateKey, timezone);
    const result = await this.prisma.stepLog.aggregate({
      where: { userId, isManual: false, bucketStart: { gte: start, lt: end } },
      _sum: { steps: true },
    });
    return { date: dateKey, steps: result._sum.steps ?? 0 };
  }

  async getHistory(userId: string, fromDateKey: string, toDateKey: string, timezone: string) {
    const { start } = localDayBoundsUtc(fromDateKey, timezone);
    const { end } = localDayBoundsUtc(toDateKey, timezone);
    return this.prisma.stepLog.findMany({
      where: { userId, bucketStart: { gte: start, lt: end } },
      orderBy: { bucketStart: 'asc' },
    });
  }

  private async upsertBucket(
    tx: Tx,
    userId: string,
    bucket: StepSyncDto['buckets'][number],
    clientBatchId: string,
  ) {
    const start = new Date(bucket.bucketStart);
    const end = new Date(bucket.bucketEnd);
    const durationMinutes = Math.max(1, (end.getTime() - start.getTime()) / 60_000);
    const maxPlausible = Math.round(durationMinutes * MAX_STEPS_PER_MINUTE);
    const clampedSteps = Math.min(bucket.steps, maxPlausible);

    await tx.stepLog.upsert({
      where: {
        userId_bucketStart_bucketEnd_source: {
          userId,
          bucketStart: start,
          bucketEnd: end,
          source: bucket.source,
        },
      },
      create: {
        userId,
        bucketStart: start,
        bucketEnd: end,
        steps: clampedSteps,
        distanceMeters: bucket.distanceMeters,
        activeEnergy: bucket.activeEnergy,
        source: bucket.source,
        isManual: bucket.isManual ?? false,
        clientBatchId,
      },
      update: {
        steps: clampedSteps,
        distanceMeters: bucket.distanceMeters,
        activeEnergy: bucket.activeEnergy,
      },
    });
  }

  private async sumNonManualSteps(tx: Tx, userId: string, start: Date, end: Date): Promise<number> {
    const result = await tx.stepLog.aggregate({
      where: { userId, isManual: false, bucketStart: { gte: start, lt: end } },
      _sum: { steps: true },
    });
    return result._sum.steps ?? 0;
  }

  private async updateStreak(tx: Tx, userId: string, dateKey: string, stepsToday: number): Promise<number> {
    const streak = await tx.userStreak.findUniqueOrThrow({ where: { userId } });
    if (stepsToday <= 0) {
      return streak.currentStreak;
    }

    const today = dateKeyToDateColumn(dateKey);
    if (streak.lastActiveDate && streak.lastActiveDate.getTime() === today.getTime()) {
      return streak.currentStreak; // already counted today
    }

    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    let newStreak: number;
    let freezesAvailable = streak.freezesAvailable;

    if (!streak.lastActiveDate) {
      newStreak = 1;
    } else if (streak.lastActiveDate.getTime() === yesterday.getTime()) {
      newStreak = streak.currentStreak + 1;
    } else if (freezesAvailable > 0) {
      // Missed exactly one day but a streak freeze absorbs it (Endurance-affected in later phases).
      newStreak = streak.currentStreak + 1;
      freezesAvailable -= 1;
    } else {
      newStreak = 1;
    }

    await tx.userStreak.update({
      where: { userId },
      data: {
        currentStreak: newStreak,
        longestStreak: Math.max(streak.longestStreak, newStreak),
        lastActiveDate: today,
        freezesAvailable,
      },
    });

    return newStreak;
  }
}
