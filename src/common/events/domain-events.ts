import type { Conversation } from '../../entities/conversation.entity.js';
import type { MessageResponse } from '../../services/messages.service.js';

/**
 * In-process events published by domain services after a successful write.
 * Listeners in `listeners/` react to them; always use these constants, never raw strings.
 */
export const DomainEvent = {
  ConversationCreated: 'conversation.created',
  ConversationMembersAdded: 'conversation.members-added',
  ConversationDeleted: 'conversation.deleted',
  MessageCreated: 'message.created',
} as const;

export interface ConversationCreatedEvent {
  conversation: Conversation;
  memberIds: string[];
  createdBy: string;
}

export interface ConversationMembersAddedEvent {
  conversation: Conversation;
  userIds: string[];
  addedBy: string;
}

export interface ConversationDeletedEvent {
  conversationId: string;
  deletedBy: string;
}

export interface MessageCreatedEvent {
  message: MessageResponse;
}
