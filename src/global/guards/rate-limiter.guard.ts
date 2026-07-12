import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RateLimiterGuard implements CanActivate {
  private redisClient: Redis;
  private limit = 5; // Max 5 requests
  private windowSeconds = 60; // per minute

  constructor(private configService: ConfigService) {
    const host = this.configService.get<string>('REDIS_HOST') || 'localhost';
    const port = this.configService.get<number>('REDIS_PORT') || 6379;
    this.redisClient = new Redis(port, host);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const ip = request.ip;
    const key = `rate-limit:${ip}`;

    const currentCount = await this.redisClient.incr(key);

    if (currentCount === 1) {
      await this.redisClient.expire(key, this.windowSeconds);
    }

    if (currentCount > this.limit) {
      throw new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }
}
