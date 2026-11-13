-- Seed for the users table. Every user has the password '123456'.
-- Hashes use the app's scrypt format (src/common/security/password.ts).
-- Safe to run repeatedly: existing ids, usernames and emails are skipped.
--
--   docker exec -i realtimechat-db-1 psql -U postgres -d realtime_chat < src/core/database/seeds/users.seed.sql

INSERT INTO "users"
  ("id", "username", "email", "first_name", "last_name", "phone", "password_hash")
VALUES
  ('00000000-0000-4000-8000-000000000001', 'alice', 'alice@example.com', 'Alice', 'Anderson', '+10000000001', 'scrypt:b83240ad231d3761daf4506eee442582:67f3f9de343915458394f98a3531df2cb5bed49b1574c8f9497ded58ac8b1361c8e5c7f6161ba0aa3ebd4defa87773fcb8416c4cb3888dd30f38c6a7602c8c2f'),
  ('00000000-0000-4000-8000-000000000002', 'bob', 'bob@example.com', 'Bob', 'Brown', '+10000000002', 'scrypt:227326a50944c243d775371ab3f79268:e8cfc29c8aa91766fcd79431b71d2227ebead3e02774ad8c134aa2e542c69e564aa53bb7058b0d4ffc9d4d117b9a3479d808854d990170f8f51afeb82a99c7a0'),
  ('00000000-0000-4000-8000-000000000003', 'carol', 'carol@example.com', 'Carol', 'Clark', NULL, 'scrypt:27386809d2c14d4739e4ea45e0bd93f9:77aae213ed4a90a64756e2fe519e5149621c2f203fd9b31bd8b62f56aaf5f04161f65c0450bf46a8d08e8720e54a645f96ae5111950ff6890fd6934187a49915'),
  ('00000000-0000-4000-8000-000000000004', 'dave', 'dave@example.com', 'Dave', 'Davis', NULL, 'scrypt:9a9d28c4edf87c799e448c8a820681fb:6f0baa6a283d1942b1ec4d09e33b33757fba8fb605d041112f292a1607e8b9764471448ec4e5b7e95fdeaa1253c3a6811d0cd27130183c1da19533f9ff95358f'),
  ('00000000-0000-4000-8000-000000000005', 'eve', 'eve@example.com', 'Eve', 'Evans', NULL, 'scrypt:a21475005c8b43cf45c259c8128a9280:06c4e4b9967a35087317fec3765af86b6ff5a1aac2b2693335e6d042dfacccf8114dfb3ebf8c185dead2d52654f23045399373ce980e3081c21154729b0a4a6f')
ON CONFLICT DO NOTHING;
