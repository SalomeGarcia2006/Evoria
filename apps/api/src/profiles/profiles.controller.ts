import { Controller, Get, Param, Query } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { FindProfilesDto } from './dto/find-profiles.dto';
import { ProfilesService } from './profiles.service';

@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

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
}
