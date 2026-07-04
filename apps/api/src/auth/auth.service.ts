import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SKILL_KEYS } from '@stepsmart/game-config';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });
    if (existing) {
      throw new ConflictException('Email or username already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: dto.email,
          username: dto.username,
          passwordHash,
          timezone: dto.timezone || 'UTC',
        },
      });

      const character = await tx.character.create({
        data: {
          userId: created.id,
          name: dto.username,
        },
      });

      await tx.characterStat.createMany({
        data: SKILL_KEYS.map((skillKey) => ({
          characterId: character.id,
          skillKey,
          level: 1,
        })),
      });

      await tx.wallet.create({ data: { userId: created.id } });
      await tx.userStreak.create({ data: { userId: created.id } });

      return created;
    });

    return this.buildAuthResponse(user.id, user.email, user.username, user.timezone);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.buildAuthResponse(user.id, user.email, user.username, user.timezone);
  }

  private buildAuthResponse(id: string, email: string, username: string, timezone: string) {
    const accessToken = this.jwt.sign({ sub: id, email });
    return {
      accessToken,
      user: { id, email, username, timezone },
    };
  }
}
