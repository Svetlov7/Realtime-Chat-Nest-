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
import type { AuthenticatedRequest } from '../auth/authenticated-request.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreateMessageDto } from './dto/create-message.dto.js';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto.js';
import { MessagesService } from './messages.service.js';

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