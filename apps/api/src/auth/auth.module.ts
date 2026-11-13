import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { MembershipsModule } from '../memberships/memberships.module';
import { MailModule } from '../mail/mail.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { TenantsModule } from '../tenants/tenants.module';
import { UsersModule } from '../users/users.module';
import { AuthConfigService } from './auth.config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CaptchaService } from './captcha.service';
import { GoogleOAuthService } from './google-oauth.service';
import { GoogleProviderService } from './google-provider.service';
import {
  GoogleAccount,
  GoogleAccountSchema,
} from './schemas/google-account.schema';
import {
  GoogleOAuthState,
  GoogleOAuthStateSchema,
} from './schemas/google-oauth-state.schema';
import { DeveloperGuard } from './guards/developer.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { PlatformGuard } from './guards/platform.guard';
import { TenantSessionsController } from './tenant-sessions.controller';

@Module({
  imports: [
    JwtModule.register({}),
    MongooseModule.forFeature([
      { name: GoogleAccount.name, schema: GoogleAccountSchema },
      { name: GoogleOAuthState.name, schema: GoogleOAuthStateSchema },
    ]),
    MembershipsModule,
    MailModule,
    UsersModule,
    ProfilesModule,
    PermissionsModule,
    TenantsModule,
  ],
  controllers: [AuthController, TenantSessionsController],
  providers: [
    AuthConfigService,
    AuthService,
    CaptchaService,
    GoogleProviderService,
    GoogleOAuthService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PlatformGuard,
    },
    {
      provide: APP_GUARD,
      useClass: DeveloperGuard,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
