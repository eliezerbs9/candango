import { Global, Module } from '@nestjs/common';
import { DealValueService } from './deal-value.service';

/** Global so any module (QuickBooks, proposals, public proposal) can recompute a deal's value. */
@Global()
@Module({
  providers: [DealValueService],
  exports: [DealValueService],
})
export class DealValueModule {}
