import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChatSchema1760000000000 implements MigrationInterface {
  name = 'AddChatSchema1760000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN "username" character varying(100),
        ADD COLUMN "first_name" character varying(100),
        ADD COLUMN "last_name" character varying(100),
        ADD COLUMN "phone" character varying(30)
    `);
    await queryRunner.query(`
      UPDATE "users"
      SET "username" = 'user_' || replace("id"::text, '-', ''),
          "first_name" = 'Unknown',
          "last_name" = 'Unknown'
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
        ALTER COLUMN "username" SET NOT NULL,
        ALTER COLUMN "first_name" SET NOT NULL,
        ALTER COLUMN "last_name" SET NOT NULL
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "uq_users_username" ON "users" ("username")',
    );

    await queryRunner.query(`
      CREATE TABLE "conversations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" character varying(10) NOT NULL,
        "title" character varying(200),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_conversations_id" PRIMARY KEY ("id"),
        CONSTRAINT "ck_conversations_type" CHECK ("type" IN ('pair', 'group'))
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "ix_conversations_deleted_at" ON "conversations" ("deleted_at")',
    );
    await queryRunner.query(`
      CREATE TABLE "conversation_members" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "conversation_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_conversation_members_id" PRIMARY KEY ("id"),
        CONSTRAINT "uq_conversation_members_conversation_user"
          UNIQUE ("conversation_id", "user_id"),
        CONSTRAINT "fk_conversation_members_conversation"
          FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_conversation_members_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "ix_conversation_members_user_id" ON "conversation_members" ("user_id")',
    );
    await queryRunner.query(`
      CREATE TABLE "messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "content" text NOT NULL,
        "sender_id" uuid NOT NULL,
        "conversation_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_messages_id" PRIMARY KEY ("id"),
        CONSTRAINT "fk_messages_sender"
          FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_messages_conversation"
          FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "ix_messages_conversation_created_at" ON "messages" ("conversation_id", "created_at")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "messages"');
    await queryRunner.query('DROP TABLE "conversation_members"');
    await queryRunner.query('DROP INDEX "ix_conversations_deleted_at"');
    await queryRunner.query('DROP TABLE "conversations"');
    await queryRunner.query('DROP INDEX "uq_users_username"');
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN "phone",
        DROP COLUMN "last_name",
        DROP COLUMN "first_name",
        DROP COLUMN "username"
    `);
  }
}