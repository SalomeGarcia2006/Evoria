import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { FindUsersDto } from './dto/find-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @RequirePermissions('usuarios.crear')
  async create(
    @Body() createUserDto: CreateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.usersService.create(createUserDto, user),
      message: 'Usuario creado correctamente.',
    };
  }

  @Get()
  @RequirePermissions('usuarios.ver')
  async findAll(
    @Query() query: FindUsersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.usersService.findAll(query, user),
      message: 'Usuarios obtenidos correctamente.',
    };
  }

  @Get('profiles')
  @RequirePermissions('usuarios.crear')
  async findAvailableProfiles(@CurrentUser() user: AuthenticatedUser) {
    return {
      data: await this.usersService.findAvailableProfiles(user),
      message: 'Perfiles disponibles obtenidos correctamente.',
    };
  }

  @Get(':id')
  @RequirePermissions('usuarios.ver')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.usersService.findOne(id, user),
      message: 'Usuario obtenido correctamente.',
    };
  }

  @Patch(':id')
  @RequirePermissions('usuarios.editar')
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.usersService.update(id, updateUserDto, user),
      message: 'Usuario actualizado correctamente.',
    };
  }

  @Delete(':id')
  @RequirePermissions('usuarios.desactivar')
  async deactivate(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.usersService.deactivate(id, user),
      message: 'Usuario desactivado correctamente.',
    };
  }
}
