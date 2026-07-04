import { Module } from '@nestjs/common';
import { StepsService } from './steps.service';
import { StepsController } from './steps.controller';
import { WalletModule } from '../wallet/wallet.module';
import { CharacterModule } from '../character/character.module';
import { ChallengesModule } from '../challenges/challenges.module';
import { LeaderboardsModule } from '../leaderboards/leaderboards.module';

@Module({
  imports: [WalletModule, CharacterModule, ChallengesModule, LeaderboardsModule],
  controllers: [StepsController],
  providers: [StepsService],
})
export class StepsModule {}
