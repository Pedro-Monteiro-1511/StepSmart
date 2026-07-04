import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { LeaderboardsService, LeaderboardMetric, LeaderboardWindow } from './leaderboards.service';
import { periodKeys } from '../common/time.util';

@UseGuards(JwtAuthGuard)
@Controller('leaderboards')
export class LeaderboardsController {
  constructor(private readonly leaderboardsService: LeaderboardsService) {}

  @Get()
  async getTop(
    @Query('metric') metric: LeaderboardMetric = 'steps',
    @Query('window') window: LeaderboardWindow = 'daily',
    @Query('period') period?: string,
  ) {
    const periodKey = period ?? this.defaultPeriodKey(window);
    const entries = await this.leaderboardsService.getTop('individual', metric, window, periodKey);
    return { metric, window, period: periodKey, entries };
  }

  @Get('me')
  async getMine(
    @CurrentUser() user: CurrentUserPayload,
    @Query('metric') metric: LeaderboardMetric = 'steps',
    @Query('window') window: LeaderboardWindow = 'daily',
    @Query('period') period?: string,
  ) {
    const periodKey = period ?? this.defaultPeriodKey(window);
    const result = await this.leaderboardsService.getRank('individual', metric, window, periodKey, user.id);
    return { metric, window, period: periodKey, ...result };
  }

  private defaultPeriodKey(window: LeaderboardWindow): string {
    if (window === 'all_time') return 'all';
    const periods = periodKeys(new Date(), 'utc');
    return periods[window];
  }
}
