import { Injectable, NotFoundException } from '@nestjs/common';
import { hashPassword } from '../common/security/password.js';
import { CreateUserDto, UpdateUserDto } from '../dto/users/index.js';
import { User } from '../entities/user.entity.js';
import { UsersRepository } from '../repositories/users.repository.js';

type PublicUser = Omit<User, 'passwordHash'>;

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async create(createUserDto: CreateUserDto): Promise<PublicUser> {
    const { password, ...profile } = createUserDto;
    const user = await this.usersRepository.create({
      ...profile,
      passwordHash: await hashPassword(password),
    });
    return this.toPublicUser(user);
  }

  async findAll(): Promise<PublicUser[]> {
    const users = await this.usersRepository.findAll();
    return users.map((user) => this.toPublicUser(user));
  }

  async findOne(id: string): Promise<PublicUser> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return this.toPublicUser(user);
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<PublicUser> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    const updatedUser = await this.usersRepository.update(user, updateUserDto);
    return this.toPublicUser(updatedUser);
  }

  async remove(id: string): Promise<void> {
    if (!(await this.usersRepository.deleteById(id))) {
      throw new NotFoundException(`User ${id} not found`);
    }
  }

  private toPublicUser(user: User): PublicUser {
    const { passwordHash: _passwordHash, ...publicUser } = user;
    return publicUser;
  }
}
