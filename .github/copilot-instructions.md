# NestJS + TypeORM Architectural Rules

When generating code, scaffolding features, or creating modules, strictly adhere to the Modular structure with TypeORM patterns below.

## Directory Layout
- `src/config/database.config.ts` - TypeORM DataSource options (env-based, SSL, migrations path).
- `src/core/database/` - Database module, custom migration scripts, seeds, and base entities/repositories.
- `src/common/` - Guards, filters, interceptors, decorators, pipes, common DTOs.
- `src/modules/<feature_name>/` - Feature modules:
  - `<feature>.controller.ts`
  - `<feature>.module.ts` (Registers entities via `TypeOrmModule.forFeature([Entity])`)
  - `<feature>.service.ts` (Injects `@InjectRepository(Entity)`)
  - `entities/<feature>.entity.ts` (TypeORM `@Entity()` definition)
  - `dto/` (Validated DTOs with `class-validator`, exported via `index.ts`)
  - `repositories/` (Optional: Custom TypeORM repositories extending `Repository<T>`)

## TypeORM Guidelines
1. Always use `@Entity()`, `@PrimaryGeneratedColumn()`, `@Column()`, `@CreateDateColumn()`, `@UpdateDateColumn()`.
2. Do not use `synchronize: true` in production configs. Use TypeORM migrations.
3. Feature modules must import `TypeOrmModule.forFeature([Entity1, Entity2])`.