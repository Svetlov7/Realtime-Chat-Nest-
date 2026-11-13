import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  AttachmentFileDto,
  CreateAttachmentsBatchDto,
} from '../dto/attachments/index.js';
import type {
  AttachmentKind,
  MessageAttachment,
} from '../entities/message-attachment.entity.js';
import { MessageAttachmentsRepository } from '../repositories/message-attachments.repository.js';
import { ConversationsService } from './conversations.service.js';
import { StorageService } from './storage.service.js';
import type { PresignedUpload } from './storage.service.js';

export interface AttachmentUpload {
  attachmentId: string;
  kind: AttachmentKind;
  upload: PresignedUpload;
}

export interface AttachmentResponse {
  id: string;
  kind: AttachmentKind;
  fileName: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  url: string;
}

const PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const CLEANUP_BATCH_SIZE = 500;

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly attachmentsRepository: MessageAttachmentsRepository,
    private readonly storageService: StorageService,
  ) {}

  async createUploads(
    conversationId: string,
    userId: string,
    dto: CreateAttachmentsBatchDto,
  ): Promise<{ attachments: AttachmentUpload[] }> {
    await this.conversationsService.assertMember(conversationId, userId);

    const maxFileSize = this.storageService.maxFileSize;
    const items = dto.files.map((file, index) => {
      if (file.size > maxFileSize) {
        throw new BadRequestException(
          `files.${index}.size must not exceed ${maxFileSize} bytes`,
        );
      }
      const id = randomUUID();
      return {
        id,
        conversationId,
        uploaderId: userId,
        s3Key: `conversations/${conversationId}/${id}`,
        kind: resolveKind(file, index),
        fileName: file.fileName,
        mimeType: file.mimeType,
        size: file.size,
        width: file.width ?? null,
        height: file.height ?? null,
        duration: file.duration ?? null,
      };
    });

    await this.attachmentsRepository.createPending(items);

    const attachments = await Promise.all(
      items.map(async (item) => ({
        attachmentId: item.id,
        kind: item.kind,
        upload: await this.storageService.createUpload(
          item.s3Key,
          item.mimeType,
          item.size,
        ),
      })),
    );
    return { attachments };
  }

  /**
   * Checks that attachments can be added to a new message: they belong to the
   * sender and conversation, are not used yet, and were uploaded to S3.
   */
  async assertAttachable(
    conversationId: string,
    userId: string,
    attachmentIds: string[],
  ): Promise<void> {
    const attachments =
      await this.attachmentsRepository.findByIds(attachmentIds);
    const byId = new Map(attachments.map((item) => [item.id, item]));

    for (const id of attachmentIds) {
      const attachment = byId.get(id);
      if (
        !attachment ||
        attachment.uploaderId !== userId ||
        attachment.conversationId !== conversationId
      ) {
        throw new BadRequestException(`Attachment ${id} not found`);
      }
      if (attachment.status !== 'pending') {
        throw new BadRequestException(`Attachment ${id} is already used`);
      }
    }

    const sizes = await Promise.all(
      attachments.map((item) => this.storageService.getObjectSize(item.s3Key)),
    );
    attachments.forEach((attachment, index) => {
      if (sizes[index] !== attachment.size) {
        throw new BadRequestException(
          `Attachment ${attachment.id} is not uploaded`,
        );
      }
    });
  }

  findForMessages(messageIds: string[]): Promise<MessageAttachment[]> {
    return this.attachmentsRepository.findByMessageIds(messageIds);
  }

  async toResponse(attachment: MessageAttachment): Promise<AttachmentResponse> {
    return {
      id: attachment.id,
      kind: attachment.kind,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      size: attachment.size,
      width: attachment.width,
      height: attachment.height,
      duration: attachment.duration,
      url: await this.storageService.getDownloadUrl(
        attachment.s3Key,
        attachment.fileName,
        attachment.kind === 'document' ? 'attachment' : 'inline',
      ),
    };
  }

  /** Removes attachments that were requested but never sent in a message. */
  async removeStalePending(now = new Date()): Promise<number> {
    const stale = await this.attachmentsRepository.findStalePending(
      new Date(now.getTime() - PENDING_TTL_MS),
      CLEANUP_BATCH_SIZE,
    );
    await this.storageService.deleteObjects(stale.map((item) => item.s3Key));
    await this.attachmentsRepository.deleteByIds(stale.map((item) => item.id));
    return stale.length;
  }
}

const KIND_MIME_PREFIX: Record<Exclude<AttachmentKind, 'document'>, string> = {
  photo: 'image/',
  video: 'video/',
  audio: 'audio/',
  voice: 'audio/',
};

// SVG can carry scripts, so it is never rendered inline as a photo.
const NON_PHOTO_IMAGES = new Set(['image/svg+xml']);

function resolveKind(file: AttachmentFileDto, index: number): AttachmentKind {
  const mimeType = file.mimeType.toLowerCase();
  if (file.kind) {
    if (
      file.kind !== 'document' &&
      (!mimeType.startsWith(KIND_MIME_PREFIX[file.kind]) ||
        NON_PHOTO_IMAGES.has(mimeType))
    ) {
      throw new BadRequestException(
        `files.${index}.kind ${file.kind} does not match mimeType ${file.mimeType}`,
      );
    }
    return file.kind;
  }

  if (mimeType.startsWith('image/') && !NON_PHOTO_IMAGES.has(mimeType)) {
    return 'photo';
  }
  if (mimeType.startsWith('video/')) {
    return 'video';
  }
  if (mimeType.startsWith('audio/')) {
    return 'audio';
  }
  return 'document';
}
