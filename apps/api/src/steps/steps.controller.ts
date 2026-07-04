import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { StepsService } from './steps.service';
import { StepSyncDto } from './dto/step-sync.dto';

@UseGuards(JwtAuthGuard)
@Controller('steps')
export class StepsController {
  constructor(private readonly stepsService: StepsService) {}

  @Post('sync')
  sync(@CurrentUser() user: CurrentUserPayload, @Body() dto: StepSyncDto) {
    return this.stepsService.sync(user.id, user.timezone, dto);
  }

  @Get('today')
  getToday(@CurrentUser() user: CurrentUserPayload) {
    return this.stepsService.getToday(user.id, user.timezone);
  }

  @Get('history')
  getHistory(
    @CurrentUser() user: CurrentUserPayload,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.stepsService.getHistory(user.id, from, to, user.timezone);
  }
}
