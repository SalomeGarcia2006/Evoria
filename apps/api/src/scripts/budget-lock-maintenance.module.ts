import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { getMongoUri } from '../app.module';

// Mantenimiento sin arrancar los procesadores de alertas de AppModule.
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ uri: getMongoUri(config) }),
    }),
  ],
})
export class BudgetLockMaintenanceModule {}
