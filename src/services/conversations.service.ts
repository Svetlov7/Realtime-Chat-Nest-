import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateConversationDto } from '../dto/conversations/index.js';
import { ConversationMembersRepository } from '../repositories/conversation-members.repository.js';
import { ConversationsRepository } from '../repositories/conversations.repository.js';
import { UsersRepository } from '../repositories/users.repository.js';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly conversationsRepository: ConversationsRepository,
    private readonly membersRepository: ConversationMembersRepository,
    private readonly usersRepository: UsersRepository,
  ) {}

  async create(userId: string, dto: CreateConversationDto) {
    const memberIds = [...new Set([userId, ...(dto.memberIds ?? [])])];
    if (dto.type === 'pair' && memberIds.length !== 2) {
      throw new ForbiddenException('Pair conversations require two members');
    }

    const existingIds = await this.usersRepository.findExistingIds(memberIds);
    if (existingIds.length !== memberIds.length) {
      throw new NotFoundException('One or more users were not found');
    }

    return this.conversationsRepository.createWithMembers(
      { type: dto.type, title: dto.title ?? null },
      memberIds,
    );
  }

  findAllForUser(userId: string) {
    return this.conversationsRepository.findAllForUser(userId);
  }

  async findOneForUser(conversationId: string, userId: string) {
    await this.assertMember(conversationId, userId);
    return this.conversationsRepository.findActiveById(conversationId);
  }

  async findMembers(conversationId: string, userId: string) {
    await this.assertMember(conversationId, userId);
    return this.membersRepository.findByConversation(conversationId);
  }

  async remove(conversationId: string, userId: string): Promise<void> {
    await this.assertMember(conversationId, userId);
    await this.conversationsRepository.softDelete(conversationId);
  }

  async assertMember(conversationId: string, userId: string): Promise<void> {
    if (!(await this.conversationsRepository.existsActive(conversationId))) {
      throw new NotFoundException('Conversation not found');
    }

    if (!(await this.membersRepository.isMember(conversationId, userId))) {
      throw new ForbiddenException('You are not a member of this conversation');
    }
  }
}
