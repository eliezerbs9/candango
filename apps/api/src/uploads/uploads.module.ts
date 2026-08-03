import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { SpacesService } from './spaces.service';

@Module({
  controllers: [UploadsController],
  providers: [SpacesService],
  exports: [SpacesService],
})
export class UploadsModule {}
