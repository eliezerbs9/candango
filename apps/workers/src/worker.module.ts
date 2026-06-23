import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaService } from './prisma.service';
import { WebhookDeliveryProcessor } from './webhook-delivery.processor';
import { EmailProcessor } from './email.processor';
import { CalendarSyncProcessor } from './calendar-sync.processor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = new URL(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379');
        return { connection: { host: url.hostname, port: Number(url.port || 6379) } };
      },
    }),
    BullModule.registerQueue({ name: 'webhook-delivery' }),
    BullModule.registerQueue({ name: 'email' }),
    BullModule.registerQueue({ name: 'calendar-sync' }),
  ],
  providers: [PrismaService, WebhookDeliveryProcessor, EmailProcessor, CalendarSyncProcessor],
})
export class WorkerModule {}
