import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ChallengesCronService } from './challenges-cron.service';
import { TavernCronService } from './tavern-cron.service';
import { ChallengesModule } from '../challenges/challenges.module';
import { TavernModule } from '../tavern/tavern.module';

@Module({
  imports: [ScheduleModule.forRoot(), ChallengesModule, TavernModule],
  providers: [ChallengesCronService, TavernCronService],
})
export class JobsModule {}
