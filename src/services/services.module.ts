import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { JwtStrategy } from '../common/strategies/jwt.strategy.js';
import { RepositoriesModule } from '../repositories/repositories.module.js';
import { AttachmentsCleanupService } from './attachments-cleanup.service.js';
import { AttachmentsService } from './attachments.service.js';
import { AuthService } from './auth.service.js';
import { ConversationsService } from './conversations.service.js';
import { MessagesService } from './messages.service.js';
import { RealtimeService } from './realtime.service.js';
import { StorageService } from './storage.service.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [
    RepositoriesModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: 3600 },
      }),
    }),
  ],
  providers: [
    AuthService,
    UsersService,
    ConversationsService,
    MessagesService,
    StorageService,
    AttachmentsService,
    AttachmentsCleanupService,
    RealtimeService,
    JwtStrategy,
    JwtAuthGuard,
  ],
  exports: [
    AuthService,
    UsersService,
    ConversationsService,
    MessagesService,
    AttachmentsService,
    RealtimeService,
    JwtAuthGuard,
  ],
})
export class ServicesModule {}
