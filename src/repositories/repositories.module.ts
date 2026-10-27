import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from '../entities/conversation.entity.js';
import { ConversationMember } from '../entities/conversation-member.entity.js';
import { Message } from '../entities/message.entity.js';
import { User } from '../entities/user.entity.js';
import { ConversationMembersRepository } from './conversation-members.repository.js';
import { ConversationsRepository } from './conversations.repository.js';
import { MessagesRepository } from './messages.repository.js';
import { UsersRepository } from './users.repository.js';

const repositories = [
  UsersRepository,
  ConversationsRepository,
  ConversationMembersRepository,
  MessagesRepository,
];

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Conversation, ConversationMember, Message]),
  ],
  providers: repositories,
  exports: repositories,
})
export class RepositoriesModule {}
