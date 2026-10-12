import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity.js';
import { CreateConversationDto } from './dto/create-conversation.dto.js';
import { Conversation } from './entities/conversation.entity.js';
import { ConversationMember } from './entities/conversation-member.entity.js';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(ConversationMember)
    private readonly memberRepository: Repository<ConversationMember>,
  ) {}

  async create(userId: string, dto: CreateConversationDto) {
    const memberIds = [...new Set([userId, ...(dto.memberIds ?? [])])];
    if (dto.type === 'pair' && memberIds.length !== 2) {
      throw new ForbiddenException('Pair conversations require two members');
    }

    return this.dataSource.transaction(async (manager) => {
      const users = await manager.getRepository(User).find({
        where: { id: In(memberIds) },
        select: { id: true },
      });
      if (users.length !== memberIds.length) {
        throw new NotFoundException('One or more users were not found');
      }

      const conversationRepository = manager.getRepository(Conversation);
      const conversation = await conversationRepository.save(
        conversationRepository.create({
          type: dto.type,
          title: dto.title ?? null,
          deletedAt: null,
        }),
      );

      const memberRepository = manager.getRepository(ConversationMember);
      await memberRepository.save(
        memberIds.map((memberId) =>
          memberRepository.create({ conversationId: conversation.id, userId: memberId }),
        ),
      );
      return conversation;
    });
  }

  async findAllForUser(userId: string) {
    return this.conversationRepository
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

  async findOneForUser(conversationId: string, userId: string) {
    await this.assertMember(conversationId, userId);
    return this.conversationRepository.findOne({
      where: { id: conversationId, deletedAt: IsNull() },
    });
  }

  async findMembers(conversationId: string, userId: string) {
    await this.assertMember(conversationId, userId);
    return this.memberRepository.find({
      where: { conversationId },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });
  }

  async remove(conversationId: string, userId: string): Promise<void> {
    await this.assertMember(conversationId, userId);
    await this.conversationRepository.update(conversationId, {
      deletedAt: new Date(),
    });
  }

  async assertMember(conversationId: string, userId: string): Promise<void> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, deletedAt: IsNull() },
      select: { id: true },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const isMember = await this.memberRepository.exist({
      where: { conversationId, userId },
    });
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this conversation');
    }
  }
}