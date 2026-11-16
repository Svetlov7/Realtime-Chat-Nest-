import { Logger } from '@nestjs/common';
import { RealtimeEvent } from '../common/realtime/events.js';
import type { Conversation } from '../entities/conversation.entity.js';
import type { MessageResponse } from '../services/messages.service.js';
import type { RealtimeService } from '../services/realtime.service.js';
import { ChatRealtimeListener } from './chat-realtime.listener.js';

describe('ChatRealtimeListener', () => {
  let listener: ChatRealtimeListener;
  let calls: string[];
  let realtime: {
    joinRoom: ReturnType<typeof vi.fn>;
    clearRoom: ReturnType<typeof vi.fn>;
    emitToUser: ReturnType<typeof vi.fn>;
    emitToRoom: ReturnType<typeof vi.fn>;
  };

  const conversation = { id: 'c1', type: 'group' } as Conversation;

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    calls = [];
    const track = (name: string) =>
      vi.fn(() => {
        calls.push(name);
      });
    realtime = {
      joinRoom: track('joinRoom'),
      clearRoom: track('clearRoom'),
      emitToUser: track('emitToUser'),
      emitToRoom: track('emitToRoom'),
    };
    listener = new ChatRealtimeListener(realtime as unknown as RealtimeService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('joins members to the room before announcing a new conversation', () => {
    listener.onConversationCreated({
      conversation,
      memberIds: ['u1', 'u2'],
      createdBy: 'u1',
    });

    expect(realtime.joinRoom).toHaveBeenCalledWith('u1', 'conversation:c1');
    expect(realtime.joinRoom).toHaveBeenCalledWith('u2', 'conversation:c1');
    expect(realtime.emitToUser).toHaveBeenCalledWith(
      ['u1', 'u2'],
      RealtimeEvent.ConversationJoined,
      { conversation },
    );
    expect(calls).toEqual(['joinRoom', 'joinRoom', 'emitToUser']);
  });

  it('joins new members, tells them, then tells the whole room', () => {
    listener.onMembersAdded({ conversation, userIds: ['u3'], addedBy: 'u1' });

    expect(realtime.joinRoom).toHaveBeenCalledWith('u3', 'conversation:c1');
    expect(realtime.emitToUser).toHaveBeenCalledWith(
      ['u3'],
      RealtimeEvent.ConversationJoined,
      { conversation },
    );
    expect(realtime.emitToRoom).toHaveBeenCalledWith(
      'conversation:c1',
      RealtimeEvent.ConversationMembersAdded,
      { conversationId: 'c1', userIds: ['u3'], addedBy: 'u1' },
    );
    expect(calls).toEqual(['joinRoom', 'emitToUser', 'emitToRoom']);
  });

  it('announces a deleted conversation and then empties its room', () => {
    listener.onConversationDeleted({ conversationId: 'c1', deletedBy: 'u1' });

    expect(realtime.emitToRoom).toHaveBeenCalledWith(
      'conversation:c1',
      RealtimeEvent.ConversationDeleted,
      { conversationId: 'c1', deletedBy: 'u1' },
    );
    expect(realtime.clearRoom).toHaveBeenCalledWith('conversation:c1');
    expect(calls).toEqual(['emitToRoom', 'clearRoom']);
  });

  it('sends a new message to the conversation room', () => {
    const message = { id: 'm1', conversationId: 'c1' } as MessageResponse;

    listener.onMessageCreated({ message });

    expect(realtime.emitToRoom).toHaveBeenCalledWith(
      'conversation:c1',
      RealtimeEvent.MessageCreated,
      message,
    );
  });
});
