import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RolesModule } from './roles/roles.module';
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
    RolesModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
