import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { BudgetsService } from './budgets.service';
import { CreateBudgetRequestDto } from './dto/create-budget-request.dto';
import { FindBudgetsDto } from './dto/find-budgets.dto';
import { InitializeEventBudgetDto } from './dto/initialize-event-budget.dto';
import { RejectBudgetRequestDto } from './dto/reject-budget-request.dto';

@Controller('budgets')
export class BudgetOverviewController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get()
  @RequirePermissions('presupuestos.ver')
  async overview(
    @Query() query: FindBudgetsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.budgetsService.overview(query, user),
      message: 'Presupuestos obtenidos correctamente.',
    };
  }

  @Get('authorizations')
  @RequirePermissions('presupuestos.aprobar')
  async authorizations(@CurrentUser() user: AuthenticatedUser) {
    return {
      data: await this.budgetsService.authorizations(user),
      message: 'Autorizaciones pendientes obtenidas correctamente.',
    };
  }
}

@Controller('events/:eventId/budget')
export class EventBudgetController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get()
  @RequirePermissions('presupuestos.ver')
  async detail(
    @Param('eventId') eventId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.budgetsService.detail(eventId, user),
      message: 'Presupuesto del evento obtenido correctamente.',
    };
  }

  @Post()
  @RequirePermissions('presupuestos.editar')
  async initialize(
    @Param('eventId') eventId: string,
    @Body() dto: InitializeEventBudgetDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.budgetsService.initialize(
        eventId,
        dto.baseAmountCop,
        user,
      ),
      message: 'Presupuesto inicial registrado correctamente.',
    };
  }

  @Post('requests')
  @RequirePermissions('presupuestos.editar')
  async submitRequest(
    @Param('eventId') eventId: string,
    @Body() dto: CreateBudgetRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.budgetsService.submitRequest(eventId, dto, user),
      message: 'Solicitud de presupuesto enviada para autorización.',
    };
  }

  @Post('requests/:requestId/approve')
  @RequirePermissions('presupuestos.aprobar')
  async approve(
    @Param('eventId') eventId: string,
    @Param('requestId') requestId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.budgetsService.approve(eventId, requestId, user),
      message: 'Solicitud aprobada correctamente.',
    };
  }

  @Post('requests/:requestId/reject')
  @RequirePermissions('presupuestos.aprobar')
  async reject(
    @Param('eventId') eventId: string,
    @Param('requestId') requestId: string,
    @Body() dto: RejectBudgetRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.budgetsService.reject(
        eventId,
        requestId,
        dto.reason,
        user,
      ),
      message: 'Solicitud rechazada correctamente.',
    };
  }
}
