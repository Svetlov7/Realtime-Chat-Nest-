import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from '../entities/conversation.entity.js';
import { ConversationMember } from '../entities/conversation-member.entity.js';
import { MessageAttachment } from '../entities/message-attachment.entity.js';
import { Message } from '../entities/message.entity.js';
import { RefreshToken } from '../entities/refresh-token.entity.js';
import { User } from '../entities/user.entity.js';
import { ConversationMembersRepository } from './conversation-members.repository.js';
import { ConversationsRepository } from './conversations.repository.js';
import { MessageAttachmentsRepository } from './message-attachments.repository.js';
import { MessagesRepository } from './messages.repository.js';
import { RefreshTokensRepository } from './refresh-tokens.repository.js';
import { UsersRepository } from './users.repository.js';

const repositories = [
  UsersRepository,
  ConversationsRepository,
  ConversationMembersRepository,
  MessagesRepository,
  MessageAttachmentsRepository,
  RefreshTokensRepository,
];

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Conversation,
      ConversationMember,
      Message,
      MessageAttachment,
      RefreshToken,
    ]),
  ],
  providers: repositories,
  exports: repositories,
})
export class RepositoriesModule {}
