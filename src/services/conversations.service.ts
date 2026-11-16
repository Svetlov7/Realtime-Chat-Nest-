import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DomainEvent,
  type ConversationCreatedEvent,
  type ConversationDeletedEvent,
  type ConversationMembersAddedEvent,
} from '../common/events/domain-events.js';
import {
  AddMembersDto,
  CreateConversationDto,
} from '../dto/conversations/index.js';
import { ConversationMembersRepository } from '../repositories/conversation-members.repository.js';
import { ConversationsRepository } from '../repositories/conversations.repository.js';
import { UsersRepository } from '../repositories/users.repository.js';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly conversationsRepository: ConversationsRepository,
    private readonly membersRepository: ConversationMembersRepository,
    private readonly usersRepository: UsersRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(userId: string, dto: CreateConversationDto) {
    const memberIds = [...new Set([userId, ...(dto.memberIds ?? [])])];
    if (dto.type === 'pair' && memberIds.length !== 2) {
      throw new ForbiddenException('Pair conversations require two members');
    }

    await this.assertUsersExist(memberIds);

    const conversation = await this.conversationsRepository.createWithMembers(
      { type: dto.type, title: dto.title ?? null },
      memberIds,
    );
    this.eventEmitter.emit(DomainEvent.ConversationCreated, {
      conversation,
      memberIds,
      createdBy: userId,
    } satisfies ConversationCreatedEvent);
    return conversation;
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

  async addMembers(conversationId: string, userId: string, dto: AddMembersDto) {
    await this.assertMember(conversationId, userId);
    const conversation =
      await this.conversationsRepository.findActiveById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    if (conversation.type !== 'group') {
      throw new BadRequestException(
        'Members can only be added to group conversations',
      );
    }

    await this.assertUsersExist(dto.userIds);

    const currentIds = new Set(
      await this.membersRepository.findUserIds(conversationId),
    );
    const newIds = dto.userIds.filter((id) => !currentIds.has(id));
    if (newIds.length > 0) {
      await this.membersRepository.addMembers(conversationId, newIds);
      this.eventEmitter.emit(DomainEvent.ConversationMembersAdded, {
        conversation,
        userIds: newIds,
        addedBy: userId,
      } satisfies ConversationMembersAddedEvent);
    }

    return this.membersRepository.findByConversation(conversationId);
  }

  async remove(conversationId: string, userId: string): Promise<void> {
    await this.assertMember(conversationId, userId);
    await this.conversationsRepository.softDelete(conversationId);
    this.eventEmitter.emit(DomainEvent.ConversationDeleted, {
      conversationId,
      deletedBy: userId,
    } satisfies ConversationDeletedEvent);
  }

  async assertMember(conversationId: string, userId: string): Promise<void> {
    if (!(await this.conversationsRepository.existsActive(conversationId))) {
      throw new NotFoundException('Conversation not found');
    }

    if (!(await this.membersRepository.isMember(conversationId, userId))) {
      throw new ForbiddenException('You are not a member of this conversation');
    }
  }

  private async assertUsersExist(userIds: string[]): Promise<void> {
    const existingIds = await this.usersRepository.findExistingIds(userIds);
    if (existingIds.length !== userIds.length) {
      throw new NotFoundException('One or more users were not found');
    }
  }
}
