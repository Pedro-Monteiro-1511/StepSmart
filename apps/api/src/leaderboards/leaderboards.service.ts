import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

export type LeaderboardMetric = 'steps' | 'xp';
export type LeaderboardWindow = 'daily' | 'weekly' | 'monthly' | 'all_time';

/** Live rankings are Redis Sorted Sets — O(log n) writes/reads, no scanning millions of rows. */
@Injectable()
export class LeaderboardsService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private key(scope: 'individual' | 'clan', metric: LeaderboardMetric, window: LeaderboardWindow, periodKey: string) {
    return `lb:${scope}:${metric}:${window}:${periodKey}`;
  }

  /** Sets an absolute score (not an increment) — callers always pass the current cumulative total. */
  async setScore(
    scope: 'individual' | 'clan',
    metric: LeaderboardMetric,
    window: LeaderboardWindow,
    periodKey: string,
    subjectId: string,
    score: number,
  ) {
    await this.redis.zadd(this.key(scope, metric, window, periodKey), score, subjectId);
  }

  async getTop(
    scope: 'individual' | 'clan',
    metric: LeaderboardMetric,
    window: LeaderboardWindow,
    periodKey: string,
    limit = 50,
  ) {
    const raw = await this.redis.zrevrange(this.key(scope, metric, window, periodKey), 0, limit - 1, 'WITHSCORES');
    const entries: { subjectId: string; score: number; rank: number }[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      entries.push({ subjectId: raw[i], score: Number(raw[i + 1]), rank: i / 2 + 1 });
    }
    return entries;
  }

  async getRank(
    scope: 'individual' | 'clan',
    metric: LeaderboardMetric,
    window: LeaderboardWindow,
    periodKey: string,
    subjectId: string,
  ) {
    const rank = await this.redis.zrevrank(this.key(scope, metric, window, periodKey), subjectId);
    const score = await this.redis.zscore(this.key(scope, metric, window, periodKey), subjectId);
    return { rank: rank === null ? null : rank + 1, score: score ? Number(score) : 0 };
  }
}
