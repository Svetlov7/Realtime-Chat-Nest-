import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConversationsService } from './conversations.service.js';
import { CreateMessageDto } from './dto/create-message.dto.js';
import { Message } from './entities/message.entity.js';

@Injectable()
export class MessagesService {
  constructor(
    private readonly conversationsService: ConversationsService,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
  ) {}

  async create(
    conversationId: string,
    senderId: string,
    dto: CreateMessageDto,
  ) {
    await this.conversationsService.assertMember(conversationId, senderId);
    return this.messageRepository.save(
      this.messageRepository.create({
        conversationId,
        senderId,
        content: dto.content,
      }),
    );
  }

  async findAll(
    conversationId: string,
    userId: string,
    limit: number,
    before?: string,
  ) {
    await this.conversationsService.assertMember(conversationId, userId);
    const query = this.messageRepository
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