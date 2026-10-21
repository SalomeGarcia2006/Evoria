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
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { FindSchedulesDto } from './dto/find-schedules.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { SchedulesService } from './schedules.service';

@Controller()
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Post('events/:eventId/schedules')
  @RequirePermissions('cronogramas.crear')
  async create(
    @Param('eventId') eventId: string,
    @Body() createScheduleDto: CreateScheduleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.schedulesService.create(
        eventId,
        createScheduleDto,
        user,
      ),
      message: 'Actividad creada correctamente.',
    };
  }

  @Get('events/:eventId/schedules')
  @RequirePermissions('cronogramas.ver')
  async findAll(
    @Param('eventId') eventId: string,
    @Query() query: FindSchedulesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.schedulesService.findAll(eventId, query, user),
      message: 'Actividades obtenidas correctamente.',
    };
  }

  @Patch('schedules/:id')
  @RequirePermissions('cronogramas.editar')
  async update(
    @Param('id') id: string,
    @Body() updateScheduleDto: UpdateScheduleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.schedulesService.update(id, updateScheduleDto, user),
      message: 'Actividad actualizada correctamente.',
    };
  }

  @Delete('schedules/:id')
  @RequirePermissions('cronogramas.eliminar')
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.schedulesService.cancel(id, user),
      message: 'Actividad cancelada correctamente.',
    };
  }
}
