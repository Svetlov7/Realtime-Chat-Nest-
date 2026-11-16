import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  DomainEvent,
  type ConversationCreatedEvent,
  type ConversationDeletedEvent,
  type ConversationMembersAddedEvent,
  type MessageCreatedEvent,
} from '../common/events/domain-events.js';
import {
  RealtimeEvent,
  type ConversationDeletedPayload,
  type ConversationJoinedPayload,
  type ConversationMembersAddedPayload,
  type MessageCreatedPayload,
} from '../common/realtime/events.js';
import { conversationRoom } from '../common/realtime/rooms.js';
import { RealtimeService } from '../services/realtime.service.js';

/** Translates chat domain events into socket.io events. */
@Injectable()
export class ChatRealtimeListener {
  private readonly logger = new Logger(ChatRealtimeListener.name);

  constructor(private readonly realtimeService: RealtimeService) {}

  @OnEvent(DomainEvent.ConversationCreated)
  onConversationCreated({
    conversation,
    memberIds,
  }: ConversationCreatedEvent): void {
    this.logger.debug(
      `${DomainEvent.ConversationCreated}: ${conversation.id} (${memberIds.length} members)`,
    );
    this.joinConversation(conversation.id, memberIds);
    this.realtimeService.emitToUser(
      memberIds,
      RealtimeEvent.ConversationJoined,
      {
        conversation,
      } satisfies ConversationJoinedPayload,
    );
  }

  @OnEvent(DomainEvent.ConversationMembersAdded)
  onMembersAdded({
    conversation,
    userIds,
    addedBy,
  }: ConversationMembersAddedEvent): void {
    this.logger.debug(
      `${DomainEvent.ConversationMembersAdded}: ${conversation.id} (+${userIds.length})`,
    );
    // Join first, so the new members also get members-added and every later event.
    this.joinConversation(conversation.id, userIds);
    this.realtimeService.emitToUser(userIds, RealtimeEvent.ConversationJoined, {
      conversation,
    } satisfies ConversationJoinedPayload);
    this.realtimeService.emitToRoom(
      conversationRoom(conversation.id),
      RealtimeEvent.ConversationMembersAdded,
      {
        conversationId: conversation.id,
        userIds,
        addedBy,
      } satisfies ConversationMembersAddedPayload,
    );
  }

  @OnEvent(DomainEvent.ConversationDeleted)
  onConversationDeleted({
    conversationId,
    deletedBy,
  }: ConversationDeletedEvent): void {
    this.logger.debug(`${DomainEvent.ConversationDeleted}: ${conversationId}`);
    const room = conversationRoom(conversationId);
    this.realtimeService.emitToRoom(room, RealtimeEvent.ConversationDeleted, {
      conversationId,
      deletedBy,
    } satisfies ConversationDeletedPayload);
    this.realtimeService.clearRoom(room);
  }

  @OnEvent(DomainEvent.MessageCreated)
  onMessageCreated({ message }: MessageCreatedEvent): void {
    this.logger.debug(
      `${DomainEvent.MessageCreated}: ${message.id} in ${message.conversationId}`,
    );
    // The sender is not excluded: their other devices need the message too.
    this.realtimeService.emitToRoom(
      conversationRoom(message.conversationId),
      RealtimeEvent.MessageCreated,
      message satisfies MessageCreatedPayload,
    );
  }

  private joinConversation(conversationId: string, userIds: string[]): void {
    const room = conversationRoom(conversationId);
    for (const userId of userIds) {
      this.realtimeService.joinRoom(userId, room);
    }
  }
}
