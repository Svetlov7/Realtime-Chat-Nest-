import { Injectable } from '@nestjs/common';
import { CreateMessageDto } from '../dto/messages/index.js';
import { MessagesRepository } from '../repositories/messages.repository.js';
import { ConversationsService } from './conversations.service.js';

@Injectable()
export class MessagesService {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly messagesRepository: MessagesRepository,
  ) {}

  async create(
    conversationId: string,
    senderId: string,
    dto: CreateMessageDto,
  ) {
    await this.conversationsService.assertMember(conversationId, senderId);
    return this.messagesRepository.create({
      conversationId,
      senderId,
      content: dto.content,
    });
  }

  async findAll(
    conversationId: string,
    userId: string,
    limit: number,
    before?: string,
  ) {
    await this.conversationsService.assertMember(conversationId, userId);
    return this.messagesRepository.findPage(conversationId, limit, before);
  }
}
