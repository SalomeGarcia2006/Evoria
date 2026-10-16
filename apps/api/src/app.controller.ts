import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@evoria/contracts';
import { AppService } from './app.service';
import { Public } from './auth/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @Public()
  health(): HealthResponse {
    return this.appService.health();
  }
}
