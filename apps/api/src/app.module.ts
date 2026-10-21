import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { EventsModule } from './events/events.module';
import { InventoryModule } from './inventory/inventory.module';
import { MembershipsModule } from './memberships/memberships.module';
import { ProfilesModule } from './profiles/profiles.module';
import { ResourcesModule } from './resources/resources.module';
import { SchedulesModule } from './schedules/schedules.module';
import { TenantsModule } from './tenants/tenants.module';
import { UsersModule } from './users/users.module';

function getMongoUri(configService: ConfigService): string {
  const configuredUri = configService.get<string>('MONGODB_URI');
  if (configuredUri) return configuredUri;

  const username = encodeURIComponent(
    configService.get<string>('MONGO_ROOT_USERNAME', 'evoria'),
  );
  const password = encodeURIComponent(
    configService.get<string>('MONGO_ROOT_PASSWORD', 'evoria_local_password'),
  );
  const database = encodeURIComponent(
    configService.get<string>('MONGO_DATABASE', 'evoria'),
  );

  return `mongodb://${username}:${password}@localhost:27017/${database}?authSource=admin`;
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: getMongoUri(configService),
      }),
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: 60_000,
          limit: 100,
        },
      ],
    }),
    AuthModule,
    EventsModule,
    InventoryModule,
    MembershipsModule,
    ProfilesModule,
    ResourcesModule,
    SchedulesModule,
    TenantsModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
