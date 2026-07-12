import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './global/filters/global-exception.filter';
import { AuthLoggerInterceptor } from './global/interceptors/auth-logger.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new AuthLoggerInterceptor());
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
