import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Session } from './entities/session.entity';
import { User } from '../users/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(Session)
    private sessionsRepository: Repository<Session>,
  ) {}

  async createSession(
    user: User,
    refreshToken: string,
    expiresAt: Date,
    ipAddress?: string,
    userAgent?: string,
    deviceId?: string,
  ): Promise<Session> {
    const salt = await bcrypt.genSalt(10);
    const refreshTokenHash = await bcrypt.hash(refreshToken, salt);

    const session = this.sessionsRepository.create({
      user,
      refreshTokenHash,
      expiresAt,
      ipAddress,
      userAgent,
      deviceId,
    });

    return this.sessionsRepository.save(session);
  }

  async findValidSession(sessionId: string): Promise<Session | null> {
    const session = await this.sessionsRepository.findOne({
      where: { id: sessionId },
      relations: { user: true },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      return null;
    }

    return session;
  }

  async validateAndRotateRefreshToken(
    sessionId: string,
    oldRefreshToken: string,
    newRefreshToken: string,
    newExpiresAt: Date,
  ): Promise<Session> {
    const session = await this.sessionsRepository.findOne({
      where: { id: sessionId },
      relations: { user: true },
    });

    if (!session) {
      throw new UnauthorizedException('Session not found');
    }

    // If the session was already revoked, it means the old refresh token might have been stolen and reused.
    if (session.revokedAt) {
      throw new UnauthorizedException('Session has been revoked');
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    const isValid = await bcrypt.compare(oldRefreshToken, session.refreshTokenHash);

    if (!isValid) {
      // Refresh token reuse detected (invalid token for this valid session)
      await this.revokeSession(session.id);
      throw new UnauthorizedException('Invalid refresh token. Session revoked for security.');
    }

    // Rotate token
    const salt = await bcrypt.genSalt(10);
    session.refreshTokenHash = await bcrypt.hash(newRefreshToken, salt);
    session.expiresAt = newExpiresAt;
    session.lastUsedAt = new Date();

    return this.sessionsRepository.save(session);
  }

  async revokeSession(sessionId: string): Promise<void> {
    const session = await this.sessionsRepository.findOne({ where: { id: sessionId } });
    if (session) {
      session.revokedAt = new Date();
      await this.sessionsRepository.save(session);
    }
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.sessionsRepository.update(
      { user: { id: userId }, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async getActiveSessions(userId: string): Promise<Session[]> {
    return this.sessionsRepository.createQueryBuilder('session')
      .where('session.user_id = :userId', { userId })
      .andWhere('session.revoked_at IS NULL')
      .andWhere('session.expires_at > :now', { now: new Date() })
      .getMany();
  }
}
