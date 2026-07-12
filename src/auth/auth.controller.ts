import { Controller, Post, Body, HttpCode, HttpStatus, Get, UseGuards, Request, Delete, Param } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from '../global/guards/jwt-auth.guard';
import { SessionsService } from '../sessions/sessions.service';
import { RateLimiterGuard } from '../global/guards/rate-limiter.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private sessionsService: SessionsService,
  ) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @UseGuards(RateLimiterGuard)
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() loginDto: LoginDto, @Request() req: any) {
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];
    const deviceId = req.headers['x-device-id'] || 'unknown-device';
    return this.authService.login(loginDto, ipAddress, userAgent, deviceId);
  }

  @UseGuards(RateLimiterGuard)
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(@Body() refreshTokenDto: RefreshTokenDto, @Request() req: any) {
    // We expect the client to send the session ID somehow, usually in the token payload or headers.
    // For simplicity, let's assume the client passes the session_id in the body as well, or we extract it.
    // Wait, the session_id should probably be passed. Let's update RefreshTokenDto to require sessionId.
    // Actually, I'll update RefreshTokenDto right after this.
    const sessionId = req.body.sessionId;
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.authService.refreshTokens(sessionId, refreshTokenDto.refreshToken, ipAddress, userAgent);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req: any) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  async getSessions(@Request() req: any) {
    return this.sessionsService.getActiveSessions(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('logout')
  async logout(@Body('sessionId') sessionId: string) {
    return this.authService.logout(sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('logout-all')
  async logoutAll(@Request() req: any) {
    return this.authService.logoutAll(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('sessions/:id')
  async revokeSession(@Param('id') sessionId: string) {
    return this.authService.logout(sessionId);
  }
}
