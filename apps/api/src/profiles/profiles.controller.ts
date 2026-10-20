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
import { CreateProfileDto } from './dto/create-profile.dto';
import { FindProfilesDto } from './dto/find-profiles.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfilesService } from './profiles.service';

@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Post()
  @RequirePermissions('perfiles.crear')
  async create(
    @Body() createProfileDto: CreateProfileDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.profilesService.create(createProfileDto, user),
      message: 'Perfil creado correctamente.',
    };
  }

  @Get()
  @RequirePermissions('perfiles.ver')
  async findAll(
    @Query() query: FindProfilesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.profilesService.findAll(query, user),
      message: 'Perfiles obtenidos correctamente.',
    };
  }

  @Get(':id')
  @RequirePermissions('perfiles.ver')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.profilesService.findOne(id, user),
      message: 'Perfil obtenido correctamente.',
    };
  }

  @Patch(':id')
  @RequirePermissions('perfiles.editar')
  async update(
    @Param('id') id: string,
    @Body() updateProfileDto: UpdateProfileDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.profilesService.update(id, updateProfileDto, user),
      message: 'Perfil actualizado correctamente.',
    };
  }

  @Delete(':id')
  @RequirePermissions('perfiles.desactivar')
  async deactivate(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.profilesService.deactivate(id, user),
      message: 'Perfil desactivado correctamente.',
    };
  }
}
