-- DEV ONLY: never run this against production, the password is public.
-- Seed for the users table. Every user has the password '12345678'.
-- Hashes use the app's scrypt format (src/common/security/password.ts).
-- Safe to run repeatedly: existing ids, usernames and emails are skipped.
--
--   docker exec -i realtimechat-db-1 psql -U postgres -d realtime_chat < src/core/database/seeds/users.seed.sql

INSERT INTO "users"
  ("id", "username", "email", "first_name", "last_name", "phone", "password_hash")
VALUES
  ('00000000-0000-4000-8000-000000000001', 'alice', 'alice@example.com', 'Alice', 'Anderson', '+10000000001', 'scrypt:4696d72a8c870f4aa93927f8e1d297e4:6413c32f44315060f63264a90b61cc909471552753140a3d1cd8b7c686bd20723b7851687f17d7ec5724ba33dd6f84488d4306c40cbf3ce0f317503574b0f4db'),
  ('00000000-0000-4000-8000-000000000002', 'bob', 'bob@example.com', 'Bob', 'Brown', '+10000000002', 'scrypt:325a9761e1cd007878b3c8b0b437948b:571badd8599e2eba10d171ace2b5064bd8584dcefe64f7a47ac83cb35d4cac61d7eb866e38f772bddd8826c7cf28a10220266e1e34af543c1cd9944bc3d5f30f'),
  ('00000000-0000-4000-8000-000000000003', 'carol', 'carol@example.com', 'Carol', 'Clark', NULL, 'scrypt:881c300313e513044d717a0620250abc:abdbe03e30799fb76855c087ebf7228b3ce303f3b5ea4b9818de21514444830dca0dcdd6c79f4ed2a82164c0f6a7a4fddd4151b74cad614631df2f476dbb6351'),
  ('00000000-0000-4000-8000-000000000004', 'dave', 'dave@example.com', 'Dave', 'Davis', NULL, 'scrypt:f3faece90e478004873b92b9bd14e55e:1fa19c282f2b2b2dc405517f39d45d23242f444499e1bae7e781fb4989f84aad6cb33d2b84a69d3fd93fb33c167974b51decb586e60d8523fd40fa79d8ef6f97'),
  ('00000000-0000-4000-8000-000000000005', 'eve', 'eve@example.com', 'Eve', 'Evans', NULL, 'scrypt:7a58b9a8be5f9a42ff7dc4404bfe69c6:c87bf5299a3332b663feb0cf3be532af3fa7583e3e6027ba2400b9f59f7783465cc3d2efedbcaf3318730bf607656f1a37f30666176f5f58d40f4fd49d50eefb')
ON CONFLICT DO NOTHING;
