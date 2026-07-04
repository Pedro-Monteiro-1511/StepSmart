import { Module } from '@nestjs/common';
import { DungeonsService } from './dungeons.service';
import { DungeonsController } from './dungeons.controller';
import { WalletModule } from '../wallet/wallet.module';
import { CharacterModule } from '../character/character.module';

@Module({
  imports: [WalletModule, CharacterModule],
  controllers: [DungeonsController],
  providers: [DungeonsService],
  exports: [DungeonsService],
})
export class DungeonsModule {}
