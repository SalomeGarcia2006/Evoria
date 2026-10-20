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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateEventDto } from './dto/create-event.dto';
import { FindEventsDto } from './dto/find-events.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @RequirePermissions('eventos.crear')
  async create(
    @Body() createEventDto: CreateEventDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.eventsService.create(createEventDto, user),
      message: 'Evento creado correctamente.',
    };
  }

  @Get()
  @RequirePermissions('eventos.ver')
  async findAll(
    @Query() query: FindEventsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.eventsService.findAll(query, user),
      message: 'Eventos obtenidos correctamente.',
    };
  }

  @Get(':id')
  @RequirePermissions('eventos.ver')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.eventsService.findOne(id, user),
      message: 'Evento obtenido correctamente.',
    };
  }

  @Patch(':id')
  @RequirePermissions('eventos.editar')
  async update(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.eventsService.update(id, updateEventDto, user),
      message: 'Evento actualizado correctamente.',
    };
  }

  @Delete(':id')
  @RequirePermissions('eventos.eliminar')
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.eventsService.cancel(id, user),
      message: 'Evento cancelado correctamente.',
    };
  }
}
