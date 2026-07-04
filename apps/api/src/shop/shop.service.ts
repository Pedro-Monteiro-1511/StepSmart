import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';

@Injectable()
export class ShopService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
  ) {}

  async listItems() {
    return this.prisma.item.findMany({ where: { isActive: true }, orderBy: { priceCoins: 'asc' } });
  }

  async purchase(userId: string, itemId: string) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.item.findUnique({ where: { id: itemId } });
      if (!item || !item.isActive) {
        throw new NotFoundException('Item not found');
      }

      const character = await tx.character.findUniqueOrThrow({ where: { userId } });
      if (character.level < item.minLevel) {
        throw new BadRequestException(`Requires level ${item.minLevel}`);
      }

      await this.walletService.applyLedgerEntry(
        tx,
        userId,
        -item.priceCoins,
        TransactionType.PURCHASE,
        'item',
        item.id,
      );

      const inventory = await tx.inventory.upsert({
        where: { userId_itemId: { userId, itemId } },
        create: { userId, itemId, quantity: 1 },
        update: { quantity: { increment: 1 } },
      });

      return inventory;
    });
  }

  async listInventory(userId: string) {
    return this.prisma.inventory.findMany({
      where: { userId },
      include: { item: true },
      orderBy: { acquiredAt: 'desc' },
    });
  }

  async equip(userId: string, inventoryId: string) {
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.inventory.findUnique({ where: { id: inventoryId }, include: { item: true } });
      if (!entry || entry.userId !== userId) {
        throw new NotFoundException('Inventory item not found');
      }
      if (!entry.item.slot) {
        throw new BadRequestException('Item is not equippable');
      }

      // Unequip whatever currently occupies this slot for this user.
      await tx.inventory.updateMany({
        where: { userId, equipped: true, item: { slot: entry.item.slot } },
        data: { equipped: false },
      });

      await tx.inventory.update({ where: { id: inventoryId }, data: { equipped: true } });

      const character = await tx.character.findUniqueOrThrow({ where: { userId } });
      const equipped = { ...(character.equipped as Record<string, string>), [entry.item.slot]: inventoryId };
      await tx.character.update({ where: { userId }, data: { equipped } });

      return { equipped: true, slot: entry.item.slot };
    });
  }

  async unequip(userId: string, inventoryId: string) {
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.inventory.findUnique({ where: { id: inventoryId }, include: { item: true } });
      if (!entry || entry.userId !== userId) {
        throw new NotFoundException('Inventory item not found');
      }
      if (!entry.equipped) {
        throw new ConflictException('Item is not currently equipped');
      }

      await tx.inventory.update({ where: { id: inventoryId }, data: { equipped: false } });

      const character = await tx.character.findUniqueOrThrow({ where: { userId } });
      const equipped = { ...(character.equipped as Record<string, string>) };
      if (entry.item.slot) delete equipped[entry.item.slot];
      await tx.character.update({ where: { userId }, data: { equipped } });

      return { equipped: false };
    });
  }
}
