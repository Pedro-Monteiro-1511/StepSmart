import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient;

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getWallet(userId: string) {
    return this.prisma.wallet.findUniqueOrThrow({ where: { userId } });
  }

  async getTransactions(userId: string, take = 50, cursor?: string) {
    return this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
  }

  /**
   * Credits or debits a wallet inside an existing transaction and writes the ledger entry.
   * Throws if a debit would take the balance negative — callers must check affordability
   * up front, but this is the last line of defense against races.
   */
  async applyLedgerEntry(
    tx: Tx,
    userId: string,
    amount: number,
    type: TransactionType,
    referenceType?: string,
    referenceId?: string,
    metadata?: Record<string, unknown>,
  ) {
    const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });
    const newBalance = wallet.coinsBalance + amount;
    if (newBalance < 0) {
      throw new BadRequestException('Insufficient coins');
    }

    await tx.wallet.update({
      where: { userId },
      data: {
        coinsBalance: newBalance,
        coinsLifetime: amount > 0 ? { increment: amount } : undefined,
      },
    });

    await tx.transaction.create({
      data: {
        userId,
        type,
        amount,
        balanceAfter: newBalance,
        referenceType,
        referenceId,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });

    return newBalance;
  }
}
