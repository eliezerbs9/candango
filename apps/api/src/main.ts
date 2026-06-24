import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { tenantContextMiddleware } from './prisma/tenant.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true }); // rawBody for Stripe webhook signatures
  app.use(tenantContextMiddleware); // open a per-request tenant scope before routing
  app.setGlobalPrefix('v1');
  app.enableCors({ origin: process.env.APP_URL ?? 'http://localhost:3000', credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Candango API listening on http://localhost:${port}/v1`);
}

void bootstrap();
