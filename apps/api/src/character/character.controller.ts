import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { CharacterService } from './character.service';

@UseGuards(JwtAuthGuard)
@Controller('character')
export class CharacterController {
  constructor(private readonly characterService: CharacterService) {}

  @Get()
  getMyCharacter(@CurrentUser() user: CurrentUserPayload) {
    return this.characterService.getSummary(user.id);
  }

  @Post('skills/:skillKey/upgrade')
  upgradeSkill(@CurrentUser() user: CurrentUserPayload, @Param('skillKey') skillKey: string) {
    return this.characterService.upgradeSkill(user.id, skillKey);
  }
}
