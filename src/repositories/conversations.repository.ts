import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { ConversationMember } from '../entities/conversation-member.entity.js';
import {
  Conversation,
  ConversationType,
} from '../entities/conversation.entity.js';

@Injectable()
export class ConversationsRepository {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Conversation)
    private readonly repository: Repository<Conversation>,
  ) {}

  createWithMembers(
    data: { type: ConversationType; title: string | null },
    memberIds: string[],
  ): Promise<Conversation> {
    return this.dataSource.transaction(async (manager) => {
      const conversationRepository = manager.getRepository(Conversation);
      const conversation = await conversationRepository.save(
        conversationRepository.create({ ...data, deletedAt: null }),
      );

      const memberRepository = manager.getRepository(ConversationMember);
      await memberRepository.save(
        memberIds.map((userId) =>
          memberRepository.create({
            conversationId: conversation.id,
            userId,
          }),
        ),
      );
      return conversation;
    });
  }

  findAllForUser(userId: string): Promise<Conversation[]> {
    return this.repository
      .createQueryBuilder('conversation')
      .innerJoin(
        'conversation_members',
        'member',
        'member.conversation_id = conversation.id AND member.user_id = :userId',
        { userId },
      )
      .where('conversation.deleted_at IS NULL')
      .orderBy('conversation.created_at', 'DESC')
      .getMany();
  }

  findActiveById(id: string): Promise<Conversation | null> {
    return this.repository.findOne({ where: { id, deletedAt: IsNull() } });
  }

  existsActive(id: string): Promise<boolean> {
    return this.repository.exist({ where: { id, deletedAt: IsNull() } });
  }

  async softDelete(id: string): Promise<void> {
    await this.repository.update(id, { deletedAt: new Date() });
  }
}
