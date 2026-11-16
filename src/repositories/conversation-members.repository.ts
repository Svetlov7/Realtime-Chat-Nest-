import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConversationMember } from '../entities/conversation-member.entity.js';

@Injectable()
export class ConversationMembersRepository {
  constructor(
    @InjectRepository(ConversationMember)
    private readonly repository: Repository<ConversationMember>,
  ) {}

  findByConversation(conversationId: string): Promise<ConversationMember[]> {
    return this.repository.find({
      where: { conversationId },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });
  }

  isMember(conversationId: string, userId: string): Promise<boolean> {
    return this.repository.exist({ where: { conversationId, userId } });
  }

  findUserIds(conversationId: string): Promise<string[]> {
    return this.repository
      .find({ where: { conversationId }, select: { userId: true } })
      .then((members) => members.map((member) => member.userId));
  }

  // orIgnore: a concurrent add of the same user must not fail on the unique constraint.
  async addMembers(conversationId: string, userIds: string[]): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .insert()
      .values(userIds.map((userId) => ({ conversationId, userId })))
      .orIgnore()
      .execute();
  }
}
