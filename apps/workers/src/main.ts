import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
  // eslint-disable-next-line no-console
  console.log('Candango workers running — consuming queue "webhook-delivery"');
}

void bootstrap();
