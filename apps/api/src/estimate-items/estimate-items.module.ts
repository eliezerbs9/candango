import { Module } from '@nestjs/common';
import { EstimateItemsController } from './estimate-items.controller';
import { EstimateItemsService } from './estimate-items.service';

@Module({
  controllers: [EstimateItemsController],
  providers: [EstimateItemsService],
})
export class EstimateItemsModule {}
