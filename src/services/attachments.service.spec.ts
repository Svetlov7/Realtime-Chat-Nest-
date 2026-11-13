import { BadRequestException } from '@nestjs/common';
import type { MessageAttachment } from '../entities/message-attachment.entity.js';
import type { MessageAttachmentsRepository } from '../repositories/message-attachments.repository.js';
import { AttachmentsService } from './attachments.service.js';
import type { ConversationsService } from './conversations.service.js';
import type { StorageService } from './storage.service.js';

const CONVERSATION_ID = 'c0000000-0000-4000-8000-000000000000';
const USER_ID = 'u0000000-0000-4000-8000-000000000000';

function attachment(
  overrides: Partial<MessageAttachment> = {},
): MessageAttachment {
  return {
    id: 'a1',
    conversationId: CONVERSATION_ID,
    uploaderId: USER_ID,
    s3Key: 'conversations/c/a1',
    kind: 'photo',
    fileName: 'cat.png',
    mimeType: 'image/png',
    size: 10,
    status: 'pending',
    ...overrides,
  } as MessageAttachment;
}

describe('AttachmentsService', () => {
  let service: AttachmentsService;
  let conversationsService: { assertMember: ReturnType<typeof vi.fn> };
  let repository: {
    createPending: ReturnType<typeof vi.fn>;
    findByIds: ReturnType<typeof vi.fn>;
  };
  let storage: {
    maxFileSize: number;
    createUpload: ReturnType<typeof vi.fn>;
    getObjectSize: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    conversationsService = {
      assertMember: vi.fn().mockResolvedValue(undefined),
    };
    repository = {
      createPending: vi.fn().mockResolvedValue([]),
      findByIds: vi.fn(),
    };
    storage = {
      maxFileSize: 100,
      createUpload: vi.fn().mockResolvedValue({ url: 'http://s3', fields: {} }),
      getObjectSize: vi.fn(),
    };
    service = new AttachmentsService(
      conversationsService as unknown as ConversationsService,
      repository as unknown as MessageAttachmentsRepository,
      storage as unknown as StorageService,
    );
  });

  describe('createUploads', () => {
    it('creates pending rows and presigned uploads in request order', async () => {
      const result = await service.createUploads(CONVERSATION_ID, USER_ID, {
        files: [
          { fileName: 'cat.png', mimeType: 'image/png', size: 10 },
          { fileName: 'song.mp3', mimeType: 'audio/mpeg', size: 20 },
          {
            fileName: 'note.ogg',
            mimeType: 'audio/ogg',
            size: 5,
            kind: 'voice',
          },
          { fileName: 'logo.svg', mimeType: 'image/svg+xml', size: 5 },
          { fileName: 'a.pdf', mimeType: 'application/pdf', size: 30 },
        ],
      });

      expect(conversationsService.assertMember).toHaveBeenCalledWith(
        CONVERSATION_ID,
        USER_ID,
      );
      expect(result.attachments.map((item) => item.kind)).toEqual([
        'photo',
        'audio',
        'voice',
        'document',
        'document',
      ]);

      const rows = repository.createPending.mock.calls[0][0];
      expect(rows[0]).toMatchObject({
        uploaderId: USER_ID,
        s3Key: `conversations/${CONVERSATION_ID}/${result.attachments[0].attachmentId}`,
      });
      expect(storage.createUpload).toHaveBeenCalledWith(
        rows[1].s3Key,
        'audio/mpeg',
        20,
      );
    });

    it('rejects files over the size limit', async () => {
      await expect(
        service.createUploads(CONVERSATION_ID, USER_ID, {
          files: [{ fileName: 'big.bin', mimeType: 'text/plain', size: 101 }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.createPending).not.toHaveBeenCalled();
    });

    it('rejects a kind that does not match the MIME type', async () => {
      await expect(
        service.createUploads(CONVERSATION_ID, USER_ID, {
          files: [
            {
              fileName: 'x.txt',
              mimeType: 'text/plain',
              size: 1,
              kind: 'photo',
            },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('assertAttachable', () => {
    it('passes for own uploaded pending attachments', async () => {
      repository.findByIds.mockResolvedValue([attachment()]);
      storage.getObjectSize.mockResolvedValue(10);

      await expect(
        service.assertAttachable(CONVERSATION_ID, USER_ID, ['a1']),
      ).resolves.toBeUndefined();
    });

    it.each([
      ['missing', [], 10],
      ['another uploader', [attachment({ uploaderId: 'other' })], 10],
      ['another conversation', [attachment({ conversationId: 'other' })], 10],
      ['already used', [attachment({ status: 'ready' })], 10],
      ['not uploaded', [attachment()], null],
      ['size mismatch', [attachment()], 11],
    ])('rejects %s attachments', async (_, found, objectSize) => {
      repository.findByIds.mockResolvedValue(found);
      storage.getObjectSize.mockResolvedValue(objectSize);

      await expect(
        service.assertAttachable(CONVERSATION_ID, USER_ID, ['a1']),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
