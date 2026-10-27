import { Module } from '@nestjs/common';
import { ServicesModule } from '../services/services.module.js';
import { AuthController } from './auth.controller.js';
import { ConversationsController } from './conversations.controller.js';
import { MessagesController } from './messages.controller.js';
import { UsersController } from './users.controller.js';

@Module({
  imports: [ServicesModule],
  controllers: [
    AuthController,
    UsersController,
    ConversationsController,
    MessagesController,
  ],
})
export class ControllersModule {}
