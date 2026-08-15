import { Global, Module } from '@nestjs/common';
import { DealEventsController } from './deal-events.controller';
import { DealEventsService } from './deal-events.service';

/** Global so any module (automations, signatures, proposals) can log deal timeline events. */
@Global()
@Module({
  controllers: [DealEventsController],
  providers: [DealEventsService],
  exports: [DealEventsService],
})
export class DealEventsModule {}
