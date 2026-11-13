import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Message } from '../entities/message.entity.js';
import { MessageAttachmentsRepository } from './message-attachments.repository.js';

@Injectable()
export class MessagesRepository {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Message)
    private readonly repository: Repository<Message>,
    private readonly attachmentsRepository: MessageAttachmentsRepository,
  ) {}

  create(data: {
    conversationId: string;
    senderId: string;
    content: string;
  }): Promise<Message> {
    return this.repository.save(this.repository.create(data));
  }

  createWithAttachments(
    data: { conversationId: string; senderId: string; content: string },
    attachmentIds: string[],
  ): Promise<Message> {
    return this.dataSource.transaction(async (manager) => {
      const messageRepository = manager.getRepository(Message);
      const message = await messageRepository.save(
        messageRepository.create(data),
      );

      const attached = await this.attachmentsRepository.attachToMessage(
        manager,
        attachmentIds,
        message.id,
      );
      if (!attached) {
        throw new ConflictException('Attachment is already used');
      }
      return message;
    });
  }

  findPage(
    conversationId: string,
    limit: number,
    before?: string,
  ): Promise<Message[]> {
    const query = this.repository
      .createQueryBuilder('message')
      .where('message.conversation_id = :conversationId', { conversationId })
      .orderBy('message.created_at', 'ASC')
      .addOrderBy('message.id', 'ASC')
      .take(limit);

    if (before) {
      query.andWhere('message.created_at < :before', { before });
    }
    return query.getMany();
  }
}
