import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { AttachmentsService } from './attachments.service.js';

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

@Injectable()
export class AttachmentsCleanupService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(AttachmentsCleanupService.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly attachmentsService: AttachmentsService) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.run(), CLEANUP_INTERVAL_MS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
  }

  private async run(): Promise<void> {
    try {
      const removed = await this.attachmentsService.removeStalePending();
      if (removed > 0) {
        this.logger.log(`Removed ${removed} stale pending attachments`);
      }
    } catch (error) {
      this.logger.error('Failed to remove stale attachments', error);
    }
  }
}
