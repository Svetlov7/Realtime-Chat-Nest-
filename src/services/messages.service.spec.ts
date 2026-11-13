import { BadRequestException } from '@nestjs/common';
import type { Message } from '../entities/message.entity.js';
import type { MessagesRepository } from '../repositories/messages.repository.js';
import type { AttachmentsService } from './attachments.service.js';
import type { ConversationsService } from './conversations.service.js';
import { MessagesService } from './messages.service.js';

const CONVERSATION_ID = 'c1';
const USER_ID = 'u1';

describe('MessagesService', () => {
  let service: MessagesService;
  let conversationsService: { assertMember: ReturnType<typeof vi.fn> };
  let attachmentsService: {
    assertAttachable: ReturnType<typeof vi.fn>;
    findForMessages: ReturnType<typeof vi.fn>;
    toResponse: ReturnType<typeof vi.fn>;
  };
  let repository: {
    create: ReturnType<typeof vi.fn>;
    createWithAttachments: ReturnType<typeof vi.fn>;
  };

  const message = {
    id: 'm1',
    content: 'hi',
    senderId: USER_ID,
    conversationId: CONVERSATION_ID,
    createdAt: new Date(0),
  } as Message;

  beforeEach(() => {
    conversationsService = {
      assertMember: vi.fn().mockResolvedValue(undefined),
    };
    attachmentsService = {
      assertAttachable: vi.fn().mockResolvedValue(undefined),
      findForMessages: vi.fn().mockResolvedValue([]),
      toResponse: vi.fn((item: { id: string }) =>
        Promise.resolve({ id: item.id, url: `http://s3/${item.id}` }),
      ),
    };
    repository = {
      create: vi.fn().mockResolvedValue(message),
      createWithAttachments: vi.fn().mockResolvedValue(message),
    };
    service = new MessagesService(
      conversationsService as unknown as ConversationsService,
      attachmentsService as unknown as AttachmentsService,
      repository as unknown as MessagesRepository,
    );
  });

  it('rejects a message without content and attachments', async () => {
    await expect(
      service.create(CONVERSATION_ID, USER_ID, { content: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('creates a text-only message without touching attachments', async () => {
    const result = await service.create(CONVERSATION_ID, USER_ID, {
      content: 'hi',
    });

    expect(repository.create).toHaveBeenCalledWith({
      conversationId: CONVERSATION_ID,
      senderId: USER_ID,
      content: 'hi',
    });
    expect(attachmentsService.assertAttachable).not.toHaveBeenCalled();
    expect(result.attachments).toEqual([]);
  });

  it('validates and links attachments for a message with files', async () => {
    attachmentsService.findForMessages.mockResolvedValue([
      { id: 'a2', messageId: 'm1' },
      { id: 'a1', messageId: 'm1' },
    ]);

    const result = await service.create(CONVERSATION_ID, USER_ID, {
      attachmentIds: ['a2', 'a1'],
    });

    expect(attachmentsService.assertAttachable).toHaveBeenCalledWith(
      CONVERSATION_ID,
      USER_ID,
      ['a2', 'a1'],
    );
    expect(repository.createWithAttachments).toHaveBeenCalledWith(
      { conversationId: CONVERSATION_ID, senderId: USER_ID, content: '' },
      ['a2', 'a1'],
    );
    expect(result.attachments.map((item) => item.id)).toEqual(['a2', 'a1']);
  });

  it('does not create the message when attachments are invalid', async () => {
    attachmentsService.assertAttachable.mockRejectedValue(
      new BadRequestException(),
    );

    await expect(
      service.create(CONVERSATION_ID, USER_ID, { attachmentIds: ['a1'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.createWithAttachments).not.toHaveBeenCalled();
  });
});
