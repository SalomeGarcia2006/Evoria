import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { TeamsService } from './teams.service';

class CreateSpecialtyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;
}

@Controller('teams')
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}
  @Get('specialties')
  @RequirePermissions('equipos.ver')
  async specialties(@CurrentUser() user: AuthenticatedUser) {
    return {
      data: await this.teams.specialties(user),
      message: 'Especialidades obtenidas correctamente.',
    };
  }
  @Post('specialties')
  @RequirePermissions('equipos.crear')
  async createSpecialty(
    @Body() dto: CreateSpecialtyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.teams.createSpecialty(dto.name, user),
      message: 'Especialidad creada correctamente.',
    };
  }
  @Get()
  @RequirePermissions('equipos.ver')
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return {
      data: await this.teams.findAll(user),
      message: 'Equipos obtenidos correctamente.',
    };
  }
  @Get(':id')
  @RequirePermissions('equipos.ver')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.teams.findOne(id, user),
      message: 'Equipo obtenido correctamente.',
    };
  }
  @Post()
  @RequirePermissions('equipos.crear')
  async create(
    @Body() dto: CreateTeamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.teams.create(dto, user),
      message: 'Equipo creado correctamente.',
    };
  }
  @Patch(':id')
  @RequirePermissions('equipos.editar')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTeamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.teams.update(id, dto, user),
      message: 'Equipo actualizado correctamente.',
    };
  }
  @Delete(':id')
  @RequirePermissions('equipos.desactivar')
  async deactivate(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.teams.deactivate(id, user),
      message: 'Equipo desactivado correctamente.',
    };
  }
}
