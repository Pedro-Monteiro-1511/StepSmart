import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { CharacterModule } from './character/character.module';
import { WalletModule } from './wallet/wallet.module';
import { StepsModule } from './steps/steps.module';
import { ShopModule } from './shop/shop.module';
import { ChallengesModule } from './challenges/challenges.module';
import { LeaderboardsModule } from './leaderboards/leaderboards.module';
import { DungeonsModule } from './dungeons/dungeons.module';
import { TavernModule } from './tavern/tavern.module';
import { JobsModule } from './jobs/jobs.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    AuthModule,
    CharacterModule,
    WalletModule,
    StepsModule,
    ShopModule,
    ChallengesModule,
    LeaderboardsModule,
    DungeonsModule,
    TavernModule,
    JobsModule,
  ],
})
export class AppModule {}
