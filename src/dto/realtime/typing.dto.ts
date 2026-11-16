import { IsBoolean, IsUUID } from 'class-validator';

export class TypingDto {
  @IsUUID('4')
  conversationId: string;

  @IsBoolean()
  isTyping: boolean;
}
