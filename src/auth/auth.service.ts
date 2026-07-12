import { Injectable, UnauthorizedException, ConflictException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { RolesService } from '../roles/roles.service';
import { SessionsService } from '../sessions/sessions.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RoleEnum } from '../global/enums/role.enum';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from '../users/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private rolesService: RolesService,
    private sessionsService: SessionsService,
    private configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(registerDto.password, salt);

    const customerRole = await this.rolesService.findByName(RoleEnum.CUSTOMER);

    const user = await this.usersService.create({
      email: registerDto.email,
      password: hashedPassword,
      role: customerRole,
    });

    const { password, ...result } = user;
    return result;
  }

  async validateUser(email: string, pass: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    if (user && user.password && await bcrypt.compare(pass, user.password)) {
      
      const requireVerification = this.configService.get<boolean>('REQUIRE_VERIFICATION');
      if (requireVerification) {
        if (!user.email_verified && !user.phone_no_verified) {
          throw new ForbiddenException('Account is not verified. Please verify your email or phone number.');
        }
      }

      return user;
    }
    return null;
  }

  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string, deviceId?: string) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokensAndSession(user, ipAddress, userAgent, deviceId);
  }

  private async generateTokensAndSession(user: User, ipAddress?: string, userAgent?: string, deviceId?: string) {
    const payload = { 
      email: user.email, 
      sub: user.id, 
      role: user.role?.name 
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET') || 'secret',
      expiresIn: (this.configService.get<string>('JWT_ACCESS_EXPIRES') || '15m') as any,
      issuer: this.configService.get<string>('JWT_ISSUER') || 'closho',
      audience: this.configService.get<string>('JWT_AUDIENCE') || 'closho-users',
    });

    const refreshToken = crypto.randomBytes(40).toString('hex');
    
    // Simplistic date calculation (assume JWT_REFRESH_EXPIRES is roughly 30 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const session = await this.sessionsService.createSession(
      user,
      refreshToken,
      expiresAt,
      ipAddress,
      userAgent,
      deviceId
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      session_id: session.id,
    };
  }

  async refreshTokens(sessionId: string, oldRefreshToken: string, ipAddress?: string, userAgent?: string) {
    const newRefreshToken = crypto.randomBytes(40).toString('hex');
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 30);

    const session = await this.sessionsService.validateAndRotateRefreshToken(
      sessionId,
      oldRefreshToken,
      newRefreshToken,
      newExpiresAt
    );

    const payload = { 
      email: session.user.email, 
      sub: session.user.id, 
      role: session.user.role?.name 
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET') || 'secret',
      expiresIn: (this.configService.get<string>('JWT_ACCESS_EXPIRES') || '15m') as any,
      issuer: this.configService.get<string>('JWT_ISSUER') || 'closho',
      audience: this.configService.get<string>('JWT_AUDIENCE') || 'closho-users',
    });

    return {
      access_token: accessToken,
      refresh_token: newRefreshToken,
      session_id: session.id,
    };
  }

  async logout(sessionId: string) {
    await this.sessionsService.revokeSession(sessionId);
  }

  async logoutAll(userId: string) {
    await this.sessionsService.revokeAllUserSessions(userId);
  }
}
