import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { ShopService } from './shop.service';
import { PurchaseDto } from './dto/purchase.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  @Get('shop/items')
  listItems() {
    return this.shopService.listItems();
  }

  @Post('shop/purchase')
  purchase(@CurrentUser() user: CurrentUserPayload, @Body() dto: PurchaseDto) {
    return this.shopService.purchase(user.id, dto.itemId);
  }

  @Get('inventory')
  listInventory(@CurrentUser() user: CurrentUserPayload) {
    return this.shopService.listInventory(user.id);
  }

  @Post('inventory/:id/equip')
  equip(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.shopService.equip(user.id, id);
  }

  @Post('inventory/:id/unequip')
  unequip(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.shopService.unequip(user.id, id);
  }
}
