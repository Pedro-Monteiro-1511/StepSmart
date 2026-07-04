import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { WalletService } from './wallet.service';

@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  getWallet(@CurrentUser() user: CurrentUserPayload) {
    return this.walletService.getWallet(user.id);
  }

  @Get('transactions')
  getTransactions(@CurrentUser() user: CurrentUserPayload, @Query('cursor') cursor?: string) {
    return this.walletService.getTransactions(user.id, 50, cursor);
  }
}
