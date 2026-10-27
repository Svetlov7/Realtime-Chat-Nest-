import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from '../entities/message.entity.js';

@Injectable()
export class MessagesRepository {
  constructor(
    @InjectRepository(Message)
    private readonly repository: Repository<Message>,
  ) {}

  create(data: {
    conversationId: string;
    senderId: string;
    content: string;
  }): Promise<Message> {
    return this.repository.save(this.repository.create(data));
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
