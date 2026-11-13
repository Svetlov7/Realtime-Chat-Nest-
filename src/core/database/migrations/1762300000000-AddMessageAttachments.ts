import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessageAttachments1762300000000 implements MigrationInterface {
  name = 'AddMessageAttachments1762300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "messages" ALTER COLUMN "content" SET DEFAULT ''`,
    );
    await queryRunner.query(`
      CREATE TABLE "message_attachments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "message_id" uuid,
        "conversation_id" uuid NOT NULL,
        "uploader_id" uuid NOT NULL,
        "s3_key" character varying(300) NOT NULL,
        "kind" character varying(10) NOT NULL,
        "file_name" character varying(255) NOT NULL,
        "mime_type" character varying(255) NOT NULL,
        "size" bigint NOT NULL,
        "width" integer,
        "height" integer,
        "duration" integer,
        "position" smallint,
        "status" character varying(10) NOT NULL DEFAULT 'pending',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_message_attachments_id" PRIMARY KEY ("id"),
        CONSTRAINT "ck_message_attachments_kind"
          CHECK ("kind" IN ('photo', 'video', 'audio', 'voice', 'document')),
        CONSTRAINT "ck_message_attachments_status"
          CHECK ("status" IN ('pending', 'ready')),
        CONSTRAINT "fk_message_attachments_message"
          FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_message_attachments_conversation"
          FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_message_attachments_uploader"
          FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "ix_message_attachments_message_id" ON "message_attachments" ("message_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "ix_message_attachments_status_created_at" ON "message_attachments" ("status", "created_at")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "message_attachments"');
    await queryRunner.query(
      'ALTER TABLE "messages" ALTER COLUMN "content" DROP DEFAULT',
    );
  }
}
