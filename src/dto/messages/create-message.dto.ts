import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { MAX_ATTACHMENTS_PER_MESSAGE } from '../attachments/index.js';

export class CreateMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  content?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ATTACHMENTS_PER_MESSAGE)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  attachmentIds?: string[];
}
