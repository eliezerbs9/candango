import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PersonsController } from './persons.controller';
import { PersonsService } from './persons.service';

@Module({
  imports: [AuthModule],
  controllers: [PersonsController],
  providers: [PersonsService],
})
export class PersonsModule {}
