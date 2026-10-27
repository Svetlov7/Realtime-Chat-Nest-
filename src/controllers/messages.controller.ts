import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import type { AuthenticatedRequest } from '../common/types/authenticated-request.js';
import {
  CreateMessageDto,
  ListMessagesQueryDto,
} from '../dto/messages/index.js';
import { MessagesService } from '../services/messages.service.js';

@Controller('conversations/:conversationId/messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  create(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateMessageDto,
  ) {
    return this.messagesService.create(
      conversationId,
      request.user.userId,
      dto,
    );
  }

  @Get()
  findAll(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Req() request: AuthenticatedRequest,
    @Query() query: ListMessagesQueryDto,
  ) {
    return this.messagesService.findAll(
      conversationId,
      request.user.userId,
      query.limit,
      query.before,
    );
  }
}