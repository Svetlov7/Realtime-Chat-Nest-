import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { User } from '../users/entities/user.entity.js';
import { Conversation } from './entities/conversation.entity.js';
import { ConversationMember } from './entities/conversation-member.entity.js';
import { Message } from './entities/message.entity.js';
import { ConversationsController } from './conversations.controller.js';
import { ConversationsService } from './conversations.service.js';
import { MessagesController } from './messages.controller.js';
import { MessagesService } from './messages.service.js';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      User,
      Conversation,
      ConversationMember,
      Message,
    ]),
  ],
  controllers: [ConversationsController, MessagesController],
  providers: [ConversationsService, MessagesService],
})
export class ConversationsModule {}