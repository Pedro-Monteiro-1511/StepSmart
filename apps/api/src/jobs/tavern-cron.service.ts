import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TavernService } from '../tavern/tavern.service';

@Injectable()
export class TavernCronService {
  private readonly logger = new Logger(TavernCronService.name);

  constructor(private readonly tavernService: TavernService) {}

  // Quests also resolve lazily on GET/claim, but this closes the gap for users who don't
  // reopen the app (and is the hook a future "your quest is ready" push job would use).
  @Cron('*/2 * * * *')
  async resolveTavernQuests() {
    this.logger.debug('Resolving due tavern quests');
    await this.tavernService.resolveDueQuestsForAllUsers();
  }
}
