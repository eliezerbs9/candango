import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PipelinesModule } from './pipelines/pipelines.module';
import { DealsModule } from './deals/deals.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    PipelinesModule,
    DealsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
