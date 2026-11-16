import { ArrayNotEmpty, ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class AddMembersDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  userIds: string[];
}
