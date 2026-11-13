import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateMessageDto } from '../dto/messages/index.js';
import type { MessageAttachment } from '../entities/message-attachment.entity.js';
import type { Message } from '../entities/message.entity.js';
import { MessagesRepository } from '../repositories/messages.repository.js';
import { AttachmentsService } from './attachments.service.js';
import type { AttachmentResponse } from './attachments.service.js';
import { ConversationsService } from './conversations.service.js';

export interface MessageResponse {
  id: string;
  content: string;
  senderId: string;
  conversationId: string;
  createdAt: Date;
  attachments: AttachmentResponse[];
}

@Injectable()
export class MessagesService {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly attachmentsService: AttachmentsService,
    private readonly messagesRepository: MessagesRepository,
  ) {}

  async create(
    conversationId: string,
    senderId: string,
    dto: CreateMessageDto,
  ): Promise<MessageResponse> {
    const content = dto.content ?? '';
    const attachmentIds = dto.attachmentIds ?? [];
    if (content.trim() === '' && attachmentIds.length === 0) {
      throw new BadRequestException('Message must have content or attachments');
    }

    await this.conversationsService.assertMember(conversationId, senderId);
    const data = { conversationId, senderId, content };

    let message: Message;
    if (attachmentIds.length === 0) {
      message = await this.messagesRepository.create(data);
    } else {
      await this.attachmentsService.assertAttachable(
        conversationId,
        senderId,
        attachmentIds,
      );
      message = await this.messagesRepository.createWithAttachments(
        data,
        attachmentIds,
      );
    }
    const [response] = await this.toResponses([message]);
    return response;
  }

  async findAll(
    conversationId: string,
    userId: string,
    limit: number,
    before?: string,
  ): Promise<MessageResponse[]> {
    await this.conversationsService.assertMember(conversationId, userId);
    const messages = await this.messagesRepository.findPage(
      conversationId,
      limit,
      before,
    );
    return this.toResponses(messages);
  }

  private async toResponses(messages: Message[]): Promise<MessageResponse[]> {
    const attachments = await this.attachmentsService.findForMessages(
      messages.map((message) => message.id),
    );
    const byMessage = new Map<string, MessageAttachment[]>();
    for (const attachment of attachments) {
      const list = byMessage.get(attachment.messageId!) ?? [];
      list.push(attachment);
      byMessage.set(attachment.messageId!, list);
    }

    return Promise.all(
      messages.map(async (message) => ({
        id: message.id,
        content: message.content,
        senderId: message.senderId,
        conversationId: message.conversationId,
        createdAt: message.createdAt,
        attachments: await Promise.all(
          (byMessage.get(message.id) ?? []).map((attachment) =>
            this.attachmentsService.toResponse(attachment),
          ),
        ),
      })),
    );
  }
}
