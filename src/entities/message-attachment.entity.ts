import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Conversation } from './conversation.entity.js';
import { Message } from './message.entity.js';
import { User } from './user.entity.js';

export type AttachmentKind = 'photo' | 'video' | 'audio' | 'voice' | 'document';
export type AttachmentStatus = 'pending' | 'ready';

const bigintToNumber = {
  to: (value: number) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

@Entity('message_attachments')
@Index('ix_message_attachments_status_created_at', ['status', 'createdAt'])
@Check(
  'ck_message_attachments_kind',
  `"kind" IN ('photo', 'video', 'audio', 'voice', 'document')`,
)
@Check('ck_message_attachments_status', `"status" IN ('pending', 'ready')`)
export class MessageAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Message, (message) => message.attachments, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({
    name: 'message_id',
    foreignKeyConstraintName: 'fk_message_attachments_message',
  })
  message: Relation<Message> | null;

  @Index('ix_message_attachments_message_id')
  @Column({ name: 'message_id', type: 'uuid', nullable: true })
  messageId: string | null;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'conversation_id',
    foreignKeyConstraintName: 'fk_message_attachments_conversation',
  })
  conversation: Relation<Conversation>;

  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'uploader_id',
    foreignKeyConstraintName: 'fk_message_attachments_uploader',
  })
  uploader: User;

  @Column({ name: 'uploader_id', type: 'uuid' })
  uploaderId: string;

  @Column({ name: 's3_key', type: 'varchar', length: 300 })
  s3Key: string;

  @Column({ type: 'varchar', length: 10 })
  kind: AttachmentKind;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 255 })
  mimeType: string;

  @Column({ type: 'bigint', transformer: bigintToNumber })
  size: number;

  @Column({ type: 'int', nullable: true })
  width: number | null;

  @Column({ type: 'int', nullable: true })
  height: number | null;

  @Column({ type: 'int', nullable: true })
  duration: number | null;

  @Column({ type: 'smallint', nullable: true })
  position: number | null;

  @Column({ type: 'varchar', length: 10, default: 'pending' })
  status: AttachmentStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
