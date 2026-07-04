import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { ChallengesService } from './challenges.service';

@UseGuards(JwtAuthGuard)
@Controller('challenges')
export class ChallengesController {
  constructor(private readonly challengesService: ChallengesService) {}

  @Get('today')
  getToday(@CurrentUser() user: CurrentUserPayload) {
    return this.challengesService.getToday(user.id, user.timezone);
  }

  @Post(':id/claim')
  claim(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.challengesService.claim(user.id, id);
  }
}
