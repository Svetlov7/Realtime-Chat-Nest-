import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import type { EntityManager } from 'typeorm';
import {
  AttachmentKind,
  MessageAttachment,
} from '../entities/message-attachment.entity.js';

export interface PendingAttachmentData {
  id: string;
  conversationId: string;
  uploaderId: string;
  s3Key: string;
  kind: AttachmentKind;
  fileName: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  duration: number | null;
}

@Injectable()
export class MessageAttachmentsRepository {
  constructor(
    @InjectRepository(MessageAttachment)
    private readonly repository: Repository<MessageAttachment>,
  ) {}

  createPending(items: PendingAttachmentData[]): Promise<MessageAttachment[]> {
    return this.repository.save(
      items.map((item) =>
        this.repository.create({ ...item, messageId: null, status: 'pending' }),
      ),
    );
  }

  findByIds(ids: string[]): Promise<MessageAttachment[]> {
    return this.repository.findBy({ id: In(ids) });
  }

  findByMessageIds(messageIds: string[]): Promise<MessageAttachment[]> {
    if (messageIds.length === 0) {
      return Promise.resolve([]);
    }
    return this.repository.find({
      where: { messageId: In(messageIds) },
      order: { position: 'ASC' },
    });
  }

  /**
   * Links pending attachments to a message in the given order.
   * Returns false if any of them was already linked (e.g. a concurrent send).
   */
  async attachToMessage(
    manager: EntityManager,
    ids: string[],
    messageId: string,
  ): Promise<boolean> {
    for (const [position, id] of ids.entries()) {
      const result = await manager
        .createQueryBuilder()
        .update(MessageAttachment)
        .set({ messageId, position, status: 'ready' })
        .where('id = :id', { id })
        .andWhere("status = 'pending'")
        .execute();
      if (result.affected !== 1) {
        return false;
      }
    }
    return true;
  }

  findStalePending(
    olderThan: Date,
    limit: number,
  ): Promise<MessageAttachment[]> {
    return this.repository.find({
      where: { status: 'pending', createdAt: LessThan(olderThan) },
      take: limit,
    });
  }

  async deleteByIds(ids: string[]): Promise<void> {
    if (ids.length > 0) {
      await this.repository.delete({ id: In(ids) });
    }
  }
}
