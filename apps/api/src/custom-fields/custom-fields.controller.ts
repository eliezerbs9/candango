import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser, type AuthContext } from '../auth/current-user.decorator';
import { CustomFieldsService } from './custom-fields.service';
import { CreateCustomFieldDto, UpdateCustomFieldDto } from './dto/custom-field.dto';

@UseGuards(JwtAuthGuard)
@Controller('custom-fields')
export class CustomFieldsController {
  constructor(private readonly svc: CustomFieldsService) {}

  // Readable by any member (the record forms render the fields).
  @Get()
  list(@CurrentUser() u: AuthContext, @Query('entity') entity?: string) {
    return this.svc.list(u.orgId, entity);
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@CurrentUser() u: AuthContext, @Body() dto: CreateCustomFieldDto) {
    return this.svc.create(u.orgId, dto);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(@CurrentUser() u: AuthContext, @Param('id') id: string, @Body() dto: UpdateCustomFieldDto) {
    return this.svc.update(u.orgId, id, dto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @HttpCode(204)
  remove(@CurrentUser() u: AuthContext, @Param('id') id: string) {
    return this.svc.remove(u.orgId, id);
  }
}
