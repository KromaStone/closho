import { Injectable, OnModuleInit, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './entities/role.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RoleEnum } from '../global/enums/role.enum';

@Injectable()
export class RolesService implements OnModuleInit {
  constructor(
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
  ) {}

  async onModuleInit() {
    const defaultRoles = [RoleEnum.ADMIN, RoleEnum.STORE_ADMIN, RoleEnum.CUSTOMER];
    for (const roleName of defaultRoles) {
      const existingRole = await this.rolesRepository.findOne({ where: { name: roleName } });
      if (!existingRole) {
        await this.rolesRepository.save(this.rolesRepository.create({ name: roleName }));
        console.log(`Default role '${roleName}' created.`);
      }
    }
  }

  async create(createRoleDto: CreateRoleDto): Promise<Role> {
    const existingRole = await this.rolesRepository.findOne({ where: { name: createRoleDto.name } });
    if (existingRole) {
      throw new ConflictException(`Role with name '${createRoleDto.name}' already exists.`);
    }
    const newRole = this.rolesRepository.create(createRoleDto);
    return this.rolesRepository.save(newRole);
  }

  async findAll(): Promise<Role[]> {
    return this.rolesRepository.find();
  }

  async findOne(id: number): Promise<Role> {
    const role = await this.rolesRepository.findOne({ where: { id } });
    if (!role) {
      throw new NotFoundException(`Role with ID '${id}' not found`);
    }
    return role;
  }

  async findByName(name: string): Promise<Role> {
    const role = await this.rolesRepository.findOne({ where: { name } });
    if (!role) {
      throw new NotFoundException(`Role with name '${name}' not found`);
    }
    return role;
  }

  async update(id: number, updateRoleDto: UpdateRoleDto): Promise<Role> {
    const role = await this.findOne(id);
    if (updateRoleDto.name && updateRoleDto.name !== role.name) {
      const existingRole = await this.rolesRepository.findOne({ where: { name: updateRoleDto.name } });
      if (existingRole) {
        throw new ConflictException(`Role with name '${updateRoleDto.name}' already exists.`);
      }
    }
    Object.assign(role, updateRoleDto);
    return this.rolesRepository.save(role);
  }

  async remove(id: number): Promise<void> {
    const role = await this.findOne(id);
    await this.rolesRepository.remove(role);
  }
}
