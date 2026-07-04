import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ChallengesService } from '../challenges/challenges.service';

@Injectable()
export class ChallengesCronService {
  private readonly logger = new Logger(ChallengesCronService.name);

  constructor(private readonly challengesService: ChallengesService) {}

  // Runs hourly: for users whose local midnight just passed, this lazily generates
  // that day's pool the next time evaluateOnStepSync/getToday needs it. Running hourly
  // (rather than once at UTC midnight) keeps generation reasonably fresh across timezones.
  @Cron('0 * * * *')
  async generateDailyChallenges() {
    this.logger.log('Generating daily challenges for active users');
    await this.challengesService.generateForAllActiveUsers();
  }

  @Cron('5,35 * * * *')
  async closeExpiredChallenges() {
    await this.challengesService.failExpiredActiveChallenges();
  }
}
