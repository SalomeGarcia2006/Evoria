import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, type Model, type Types } from 'mongoose';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Event } from '../events/schemas/event.schema';
import {
  InventoryItem,
  type InventoryItemDocument,
} from '../inventory/schemas/inventory-item.schema';
import { CreateEventResourceDto } from './dto/create-event-resource.dto';
import {
  EventResource,
  type EventResourceDocument,
} from './schemas/event-resource.schema';

@Injectable()
export class ResourcesService {
  constructor(
    @InjectModel(EventResource.name)
    private readonly assignmentModel: Model<EventResource>,
    @InjectModel(InventoryItem.name)
    private readonly inventoryModel: Model<InventoryItem>,
    @InjectModel(Event.name) private readonly eventModel: Model<Event>,
  ) {}

  async assign(
    eventId: string,
    dto: CreateEventResourceDto,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.getTenantId(user);
    const event = await this.findEvent(eventId, tenantId);

    if (event.status === 'cancelado') {
      throw new ConflictException(
        'No puedes asignar recursos a un evento cancelado.',
      );
    }

    const inventoryItem = await this.reserveInventory(
      dto.inventoryItemId,
      dto.quantity,
      tenantId,
    );

    try {
      const assignment = await this.assignmentModel.findOneAndUpdate(
        {
          tenantId,
          eventId,
          inventoryItemId: dto.inventoryItemId,
          status: 'asignado',
        },
        {
          $setOnInsert: {
            tenantId,
            eventId,
            inventoryItemId: dto.inventoryItemId,
            assignedBy: user.id,
            assignedAt: new Date(),
            status: 'asignado',
            returnedAt: null,
          },
          $inc: { quantity: dto.quantity },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );

      return this.toResponse(assignment, inventoryItem);
    } catch (error) {
      await this.restoreInventory(
        inventoryItem._id.toString(),
        dto.quantity,
        tenantId,
      );
      throw error;
    }
  }

  async findAll(eventId: string, user: AuthenticatedUser) {
    const tenantId = this.getTenantId(user);
    await this.findEvent(eventId, tenantId);

    const assignments = await this.assignmentModel
      .find({ tenantId, eventId, status: 'asignado' })
      .sort({ assignedAt: 1 })
      .lean();
    const inventoryItems = await this.inventoryModel
      .find({
        _id: {
          $in: assignments.map((assignment) => assignment.inventoryItemId),
        },
        tenantId,
      })
      .lean();
    const inventoryById = new Map(
      inventoryItems.map((item) => [item._id.toString(), item]),
    );

    return assignments.flatMap((assignment) => {
      const inventoryItem = inventoryById.get(
        assignment.inventoryItemId.toString(),
      );
      return inventoryItem ? [this.toResponse(assignment, inventoryItem)] : [];
    });
  }

  async release(
    eventId: string,
    inventoryItemId: string,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.getTenantId(user);
    await this.findEvent(eventId, tenantId);

    if (!isValidObjectId(inventoryItemId)) {
      throw new BadRequestException(
        'El identificador del inventario no es válido.',
      );
    }

    const assignment = await this.assignmentModel.findOneAndUpdate(
      {
        tenantId,
        eventId,
        inventoryItemId,
        status: 'asignado',
      },
      { $set: { status: 'devuelto', returnedAt: new Date() } },
      { new: true },
    );
    if (!assignment) {
      throw new NotFoundException('El recurso no está asignado a este evento.');
    }

    const inventoryItem = await this.inventoryModel.findOneAndUpdate(
      {
        _id: inventoryItemId,
        tenantId,
        reservedQuantity: { $gte: assignment.quantity },
      },
      {
        $inc: {
          availableQuantity: assignment.quantity,
          reservedQuantity: -assignment.quantity,
        },
      },
      { new: true },
    );
    if (!inventoryItem) {
      await this.assignmentModel.updateOne(
        { _id: assignment._id, status: 'devuelto' },
        { $set: { status: 'asignado', returnedAt: null } },
      );
      throw new ConflictException(
        'No se pudo liberar la reserva de inventario.',
      );
    }

    return this.toResponse(assignment, inventoryItem);
  }

  private getTenantId(user: AuthenticatedUser): string {
    if (user.scope !== 'tenant' || !user.tenantId) {
      throw new ForbiddenException('Esta acción requiere una empresa activa.');
    }
    return user.tenantId;
  }

  private async findEvent(eventId: string, tenantId: string) {
    if (!isValidObjectId(eventId)) {
      throw new BadRequestException(
        'El identificador del evento no es válido.',
      );
    }

    const event = await this.eventModel.findOne({ _id: eventId, tenantId });
    if (!event) throw new NotFoundException('El evento no existe.');
    return event;
  }

  private async reserveInventory(
    inventoryItemId: string,
    quantity: number,
    tenantId: string,
  ): Promise<InventoryItemDocument> {
    if (!isValidObjectId(inventoryItemId)) {
      throw new BadRequestException(
        'El identificador del inventario no es válido.',
      );
    }

    const inventoryItem = await this.inventoryModel.findOneAndUpdate(
      {
        _id: inventoryItemId,
        tenantId,
        status: 'disponible',
        availableQuantity: { $gte: quantity },
      },
      {
        $inc: { availableQuantity: -quantity, reservedQuantity: quantity },
      },
      { new: true },
    );
    if (inventoryItem) return inventoryItem;

    const existingItem = await this.inventoryModel.exists({
      _id: inventoryItemId,
      tenantId,
    });
    if (!existingItem) {
      throw new NotFoundException('El ítem de inventario no existe.');
    }
    throw new ConflictException('No hay suficientes unidades disponibles.');
  }

  private async restoreInventory(
    inventoryItemId: string,
    quantity: number,
    tenantId: string,
  ) {
    await this.inventoryModel.updateOne(
      { _id: inventoryItemId, tenantId },
      {
        $inc: { availableQuantity: quantity, reservedQuantity: -quantity },
      },
    );
  }

  private toResponse(
    assignment:
      EventResourceDocument | (EventResource & { _id: Types.ObjectId }),
    inventoryItem:
      InventoryItemDocument | (InventoryItem & { _id: Types.ObjectId }),
  ) {
    return {
      id: assignment._id.toString(),
      eventId: assignment.eventId.toString(),
      inventoryItemId: assignment.inventoryItemId.toString(),
      quantity: assignment.quantity,
      status: assignment.status,
      assignedAt: assignment.assignedAt,
      returnedAt: assignment.returnedAt,
      inventoryItem: {
        id: inventoryItem._id.toString(),
        name: inventoryItem.name,
        type: inventoryItem.type,
        availableQuantity: inventoryItem.availableQuantity,
        unitCost: inventoryItem.unitCost,
      },
    };
  }
}
