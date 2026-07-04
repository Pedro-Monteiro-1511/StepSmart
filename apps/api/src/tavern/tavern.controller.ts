import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { TavernService } from './tavern.service';

@UseGuards(JwtAuthGuard)
@Controller('tavern')
export class TavernController {
  constructor(private readonly tavernService: TavernService) {}

  @Get('quests')
  getQuests(@CurrentUser() user: CurrentUserPayload) {
    return this.tavernService.getQuests(user.id);
  }

  @Post('quests/:id/start')
  start(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.tavernService.start(user.id, id);
  }

  @Post('quests/:id/claim')
  claim(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.tavernService.claim(user.id, id);
  }
}
