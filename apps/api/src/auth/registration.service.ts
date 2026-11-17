import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  createHash,
  createHmac,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';
import { type Model } from 'mongoose';
import { MailService } from '../mail/mail.service';
import { registrationEmail } from '../mail/templates/registration.email';
import { Membership } from '../memberships/schemas/membership.schema';
import { Tenant } from '../tenants/schemas/tenant.schema';
import { PasswordService } from '../users/password.service';
import { User } from '../users/schemas/user.schema';
import { AuthConfigService } from './auth.config';
import {
  type ConfirmRegistrationDto,
  type RegistrationDto,
} from './dto/registration.dto';
import { PendingRegistration } from './schemas/pending-registration.schema';

@Injectable()
export class RegistrationService {
  constructor(
    @InjectModel(Tenant.name) private readonly tenants: Model<Tenant>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Membership.name)
    private readonly memberships: Model<Membership>,
    @InjectModel(PendingRegistration.name)
    private readonly pending: Model<PendingRegistration>,
    private readonly passwords: PasswordService,
    private readonly mail: MailService,
    private readonly config: AuthConfigService,
  ) {}

  async link(token: string) {
    if (!/^[a-f0-9]{64}$/.test(token))
      throw new NotFoundException('El enlace de registro no es válido.');
    const tenant = await this.tenants
      .findOne({
        registrationToken: token,
        status: 'activo',
        emailDomain: { $type: 'string' },
      })
      .lean();
    if (!tenant)
      throw new NotFoundException('El enlace de registro no es válido.');
    return { companyName: tenant.name, emailDomain: tenant.emailDomain };
  }

  async request(input: RegistrationDto) {
    const tenant = await this.tenants
      .findOne({
        registrationToken: input.token,
        status: 'activo',
        emailDomain: { $type: 'string' },
      })
      .lean();
    if (!tenant)
      throw new NotFoundException('El enlace de registro no es válido.');
    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();
    const lastName = input.lastName.trim();
    if (name.length < 2 || lastName.length < 2)
      throw new BadRequestException('Ingresa nombre y apellidos válidos.');
    if (email.split('@')[1] !== tenant.emailDomain)
      throw new BadRequestException(
        'El correo no pertenece al dominio de la empresa.',
      );
    if (await this.users.exists({ email }))
      throw new ConflictException('Ya existe un usuario con ese correo.');
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const code = Array.from(
      { length: 6 },
      () => alphabet[randomInt(alphabet.length)],
    ).join('');
    const codeHash = this.codeHash(email, code);
    try {
      await this.pending.findOneAndUpdate(
        { email },
        {
          $set: {
            tenantId: tenant._id,
            name,
            lastName,
            passwordHash: this.passwords.hash(input.password),
            codeHash,
            tokenHash: this.tokenHash(input.token),
            attempts: 0,
            expiresAt: new Date(Date.now() + 10 * 60_000),
          },
        },
        { upsert: true },
      );
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 11000
      )
        throw new ConflictException(
          'Ya hay un registro en curso para ese correo.',
        );
      throw error;
    }
    const content = registrationEmail(code);
    try {
      await this.mail.send(email, content.subject, content.text, content.html);
    } catch {
      await this.pending.deleteOne({ email, codeHash });
      throw new ServiceUnavailableException('No se pudo enviar el código.');
    }
  }

  async confirm(input: ConfirmRegistrationDto) {
    const email = input.email.trim().toLowerCase();
    const tokenHash = this.tokenHash(input.token);
    const pending = await this.pending
      .findOneAndUpdate(
        {
          email,
          tokenHash,
          expiresAt: { $gt: new Date() },
          attempts: { $lt: 5 },
        },
        { $inc: { attempts: 1 } },
        { returnDocument: 'after' },
      )
      .lean();
    const storedHash = Buffer.from(pending?.codeHash ?? '', 'hex');
    const providedHash = Buffer.from(this.codeHash(email, input.code), 'hex');
    if (
      !pending ||
      storedHash.length !== providedHash.length ||
      !timingSafeEqual(storedHash, providedHash)
    )
      throw new UnauthorizedException('El código no es válido o expiró.');
    const session = await this.users.db.startSession();
    try {
      await session.withTransaction(async () => {
        const tenant = await this.tenants.collection.updateOne(
          {
            _id: pending.tenantId,
            status: 'activo',
            registrationToken: input.token,
            emailDomain: email.split('@')[1],
          },
          { $set: { registrationToken: input.token } },
          { session },
        );
        if (!tenant.matchedCount)
          throw new UnauthorizedException(
            'El enlace de registro ya no está activo.',
          );
        const consumed = await this.pending.deleteOne(
          {
            _id: pending._id,
            codeHash: pending.codeHash,
            expiresAt: { $gt: new Date() },
          },
          { session },
        );
        if (!consumed.deletedCount)
          throw new UnauthorizedException('El código no es válido o expiró.');
        const [user] = await this.users.create(
          [
            {
              name: pending.name,
              lastName: pending.lastName,
              email,
              passwordHash: pending.passwordHash,
            },
          ],
          { session },
        );
        await this.memberships.create(
          [{ userId: user._id, tenantId: pending.tenantId, profileId: null }],
          { session },
        );
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 11000
      )
        throw new ConflictException('Ya existe un usuario con ese correo.');
      throw error;
    } finally {
      await session.endSession();
    }
  }

  private tokenHash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
  private codeHash(email: string, code: string) {
    return createHmac('sha256', this.config.configuration.refreshTokenSecret)
      .update(`${email}:${code}`)
      .digest('hex');
  }
}
