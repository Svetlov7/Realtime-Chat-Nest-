import type { Conversation } from '../../entities/conversation.entity.js';
import type { MessageResponse } from '../../services/messages.service.js';

/** Socket.io event names shared with clients. See docs/realtime.md. */
export const RealtimeEvent = {
  MessageCreated: 'message:created',
  ConversationJoined: 'conversation:joined',
  ConversationMembersAdded: 'conversation:members-added',
  ConversationDeleted: 'conversation:deleted',
  /** Sent by clients and relayed to the other members. */
  ConversationTyping: 'conversation:typing',
} as const;

export type MessageCreatedPayload = MessageResponse;

export interface ConversationJoinedPayload {
  conversation: Conversation;
}

export interface ConversationMembersAddedPayload {
  conversationId: string;
  userIds: string[];
  addedBy: string;
}

export interface ConversationDeletedPayload {
  conversationId: string;
  deletedBy: string;
}

export interface ConversationTypingPayload {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}
