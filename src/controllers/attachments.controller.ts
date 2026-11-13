import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import type { AuthenticatedRequest } from '../common/types/authenticated-request.js';
import { CreateAttachmentsBatchDto } from '../dto/attachments/index.js';
import { AttachmentsService } from '../services/attachments.service.js';

@Controller('conversations/:conversationId/attachments')
@UseGuards(JwtAuthGuard)
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post('batch')
  createBatch(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateAttachmentsBatchDto,
  ) {
    return this.attachmentsService.createUploads(
      conversationId,
      request.user.userId,
      dto,
    );
  }
}
