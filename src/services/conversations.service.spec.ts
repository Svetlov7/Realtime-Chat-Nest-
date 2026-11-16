import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { DomainEvent } from '../common/events/domain-events.js';
import type { Conversation } from '../entities/conversation.entity.js';
import type { ConversationMembersRepository } from '../repositories/conversation-members.repository.js';
import type { ConversationsRepository } from '../repositories/conversations.repository.js';
import type { UsersRepository } from '../repositories/users.repository.js';
import { ConversationsService } from './conversations.service.js';

const CONVERSATION_ID = 'c1';
const USER_ID = 'u1';

describe('ConversationsService', () => {
  let service: ConversationsService;
  let conversationsRepository: {
    existsActive: ReturnType<typeof vi.fn>;
    findActiveById: ReturnType<typeof vi.fn>;
    createWithMembers: ReturnType<typeof vi.fn>;
    softDelete: ReturnType<typeof vi.fn>;
  };
  let membersRepository: {
    isMember: ReturnType<typeof vi.fn>;
    findUserIds: ReturnType<typeof vi.fn>;
    addMembers: ReturnType<typeof vi.fn>;
    findByConversation: ReturnType<typeof vi.fn>;
  };
  let usersRepository: { findExistingIds: ReturnType<typeof vi.fn> };
  let eventEmitter: { emit: ReturnType<typeof vi.fn> };

  const group = { id: CONVERSATION_ID, type: 'group' } as Conversation;

  beforeEach(() => {
    conversationsRepository = {
      existsActive: vi.fn().mockResolvedValue(true),
      findActiveById: vi.fn().mockResolvedValue(group),
      createWithMembers: vi.fn().mockResolvedValue(group),
      softDelete: vi.fn().mockResolvedValue(undefined),
    };
    membersRepository = {
      isMember: vi.fn().mockResolvedValue(true),
      findUserIds: vi.fn().mockResolvedValue([USER_ID, 'u2']),
      addMembers: vi.fn().mockResolvedValue(undefined),
      findByConversation: vi.fn().mockResolvedValue([]),
    };
    usersRepository = {
      findExistingIds: vi.fn((ids: string[]) => Promise.resolve(ids)),
    };
    eventEmitter = { emit: vi.fn() };
    service = new ConversationsService(
      conversationsRepository as unknown as ConversationsRepository,
      membersRepository as unknown as ConversationMembersRepository,
      usersRepository as unknown as UsersRepository,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  describe('addMembers', () => {
    it('adds only new members and publishes them', async () => {
      await service.addMembers(CONVERSATION_ID, USER_ID, {
        userIds: ['u2', 'u3'],
      });

      expect(membersRepository.addMembers).toHaveBeenCalledWith(
        CONVERSATION_ID,
        ['u3'],
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.ConversationMembersAdded,
        { conversation: group, userIds: ['u3'], addedBy: USER_ID },
      );
    });

    it('does nothing when everyone is already a member', async () => {
      await service.addMembers(CONVERSATION_ID, USER_ID, { userIds: ['u2'] });

      expect(membersRepository.addMembers).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('rejects pair conversations', async () => {
      conversationsRepository.findActiveById.mockResolvedValue({
        id: CONVERSATION_ID,
        type: 'pair',
      });

      await expect(
        service.addMembers(CONVERSATION_ID, USER_ID, { userIds: ['u3'] }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('rejects non-members', async () => {
      membersRepository.isMember.mockResolvedValue(false);

      await expect(
        service.addMembers(CONVERSATION_ID, USER_ID, { userIds: ['u3'] }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(membersRepository.addMembers).not.toHaveBeenCalled();
    });

    it('rejects unknown users', async () => {
      usersRepository.findExistingIds.mockResolvedValue([]);

      await expect(
        service.addMembers(CONVERSATION_ID, USER_ID, { userIds: ['u3'] }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(membersRepository.addMembers).not.toHaveBeenCalled();
    });
  });

  it('publishes a created conversation with all members', async () => {
    await service.create(USER_ID, { type: 'group', memberIds: ['u2'] });

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      DomainEvent.ConversationCreated,
      { conversation: group, memberIds: [USER_ID, 'u2'], createdBy: USER_ID },
    );
  });

  it('publishes a deleted conversation', async () => {
    await service.remove(CONVERSATION_ID, USER_ID);

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      DomainEvent.ConversationDeleted,
      { conversationId: CONVERSATION_ID, deletedBy: USER_ID },
    );
  });
});
