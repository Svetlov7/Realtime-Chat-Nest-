import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { AttachmentKind } from '../../entities/message-attachment.entity.js';

export const MAX_ATTACHMENTS_PER_MESSAGE = 10;

export class AttachmentFileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName: string;

  @IsString()
  @MaxLength(255)
  @Matches(/^[\w.+-]+\/[\w.+-]+$/, {
    message: 'mimeType must be a valid MIME type',
  })
  mimeType: string;

  @IsInt()
  @Min(1)
  size: number;

  @IsOptional()
  @IsIn(['photo', 'video', 'audio', 'voice', 'document'])
  kind?: AttachmentKind;

  @IsOptional()
  @IsInt()
  @Min(1)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  height?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  duration?: number;
}

export class CreateAttachmentsBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ATTACHMENTS_PER_MESSAGE)
  @ValidateNested({ each: true })
  @Type(() => AttachmentFileDto)
  files: AttachmentFileDto[];
}
