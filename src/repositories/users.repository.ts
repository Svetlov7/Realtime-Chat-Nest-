import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import { User } from '../entities/user.entity.js';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  create(data: Partial<User>): Promise<User> {
    return this.repository.save(this.repository.create(data));
  }

  findAll(): Promise<User[]> {
    return this.repository.find();
  }

  findById(id: string): Promise<User | null> {
    return this.repository.findOneBy({ id });
  }

  findExistingIds(ids: string[]): Promise<string[]> {
    return this.repository
      .find({ where: { id: In(ids) }, select: { id: true } })
      .then((users) => users.map((user) => user.id));
  }

  // passwordHash is select: false, so it must be requested explicitly.
  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.repository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();
  }

  update(user: User, changes: Partial<User>): Promise<User> {
    return this.repository.save(this.repository.merge(user, changes));
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return Boolean(result.affected);
  }

  isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error as QueryFailedError & { driverError?: { code?: string } })
        .driverError?.code === '23505'
    );
  }
}
