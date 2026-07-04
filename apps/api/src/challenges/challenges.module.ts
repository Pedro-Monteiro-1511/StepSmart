import { Module } from '@nestjs/common';
import { ChallengesService } from './challenges.service';
import { ChallengesController } from './challenges.controller';
import { WalletModule } from '../wallet/wallet.module';
import { CharacterModule } from '../character/character.module';

@Module({
  imports: [WalletModule, CharacterModule],
  controllers: [ChallengesController],
  providers: [ChallengesService],
  exports: [ChallengesService],
})
export class ChallengesModule {}
