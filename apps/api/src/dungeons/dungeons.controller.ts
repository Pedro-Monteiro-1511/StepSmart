import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { DungeonsService } from './dungeons.service';

@UseGuards(JwtAuthGuard)
@Controller('dungeons')
export class DungeonsController {
  constructor(private readonly dungeonsService: DungeonsService) {}

  @Get()
  getCatalog(@CurrentUser() user: CurrentUserPayload) {
    return this.dungeonsService.getCatalog(user.id);
  }

  @Get('state')
  getState(@CurrentUser() user: CurrentUserPayload) {
    return this.dungeonsService.getState(user.id, user.timezone);
  }

  @Get('runs')
  listRuns(@CurrentUser() user: CurrentUserPayload) {
    return this.dungeonsService.listRuns(user.id);
  }

  @Post(':id/enter')
  enter(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.dungeonsService.enter(user.id, user.timezone, id);
  }

  @Post('state/buy-attempt')
  buyAttempt(@CurrentUser() user: CurrentUserPayload) {
    return this.dungeonsService.buyAttempt(user.id, user.timezone);
  }
}
