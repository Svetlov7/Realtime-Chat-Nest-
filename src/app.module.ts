import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './core/database/database.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ConversationsModule } from './modules/conversations/conversations.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [DatabaseModule, AuthModule, UsersModule, ConversationsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
