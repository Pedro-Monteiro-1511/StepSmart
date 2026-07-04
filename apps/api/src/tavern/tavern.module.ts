import { Module } from '@nestjs/common';
import { TavernService } from './tavern.service';
import { TavernController } from './tavern.controller';
import { WalletModule } from '../wallet/wallet.module';
import { CharacterModule } from '../character/character.module';

@Module({
  imports: [WalletModule, CharacterModule],
  controllers: [TavernController],
  providers: [TavernService],
  exports: [TavernService],
})
export class TavernModule {}
