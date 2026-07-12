import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request } from 'express';

@Injectable()
export class AuthLoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AuthLogger');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();
    const { method, url, ip } = req;
    
    // Only intercept auth routes
    if (!url.startsWith('/auth')) {
      return next.handle();
    }

    const start = Date.now();
    const userAgent = req.headers['user-agent'] || 'unknown';

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        this.logger.log(`[SUCCESS] ${method} ${url} | IP: ${ip} | Agent: ${userAgent} | +${duration}ms`);
      }),
      catchError((error) => {
        const duration = Date.now() - start;
        this.logger.warn(`[FAILED] ${method} ${url} | IP: ${ip} | Agent: ${userAgent} | Error: ${error.message} | +${duration}ms`);
        throw error;
      }),
    );
  }
}
