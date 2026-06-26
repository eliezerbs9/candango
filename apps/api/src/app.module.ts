import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProfileModule } from './profile/profile.module';
import { OrganizationModule } from './organization/organization.module';
import { PipelinesModule } from './pipelines/pipelines.module';
import { DealsModule } from './deals/deals.module';
import { PersonsModule } from './persons/persons.module';
import { CompaniesModule } from './companies/companies.module';
import { ActivitiesModule } from './activities/activities.module';
import { ReportsModule } from './reports/reports.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { CustomFieldsModule } from './custom-fields/custom-fields.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { NotesModule } from './notes/notes.module';
import { MessagesModule } from './messages/messages.module';
import { BillingModule } from './billing/billing.module';
import { ContactModule } from './contact/contact.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = new URL(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379');
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            username: url.username || undefined,
            password: url.password || undefined,
            tls: url.protocol === 'rediss:' ? {} : undefined, // managed Redis (TLS)
            maxRetriesPerRequest: null, // required by BullMQ
          },
        };
      },
    }),
    PrismaModule,
    AuthModule,
    ProfileModule,
    OrganizationModule,
    PipelinesModule,
    DealsModule,
    PersonsModule,
    CompaniesModule,
    ActivitiesModule,
    ReportsModule,
    UsersModule,
    RolesModule,
    OnboardingModule,
    ApiKeysModule,
    WebhooksModule,
    ContactModule,
    CustomFieldsModule,
    IntegrationsModule,
    NotesModule,
    MessagesModule,
    BillingModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
