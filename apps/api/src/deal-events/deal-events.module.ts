import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DealEventsController } from './deal-events.controller';
import { DealEventsService } from './deal-events.service';

/** Global so any module (automations, signatures, proposals) can log deal timeline events. */
@Global()
@Module({
  // AuthModule provides the JwtService that ApiAuthGuard (on the controller) injects.
  imports: [AuthModule],
  controllers: [DealEventsController],
  providers: [DealEventsService],
  exports: [DealEventsService],
})
export class DealEventsModule {}
