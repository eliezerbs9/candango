import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiAuthGuard } from '../auth/api-auth.guard';
import { Scopes } from '../auth/scopes.decorator';
import { CurrentUser, type AuthContext } from '../auth/current-user.decorator';
import { PersonsService } from './persons.service';
import { CreatePersonDto, UpdatePersonDto } from './dto/person.dto';

@UseGuards(ApiAuthGuard)
@Controller('persons')
export class PersonsController {
  constructor(private readonly svc: PersonsService) {}

  @Get()
  @Scopes('persons:read')
  list(@CurrentUser() u: AuthContext) {
    return this.svc.list(u.orgId);
  }

  @Post()
  @Scopes('persons:write')
  create(@CurrentUser() u: AuthContext, @Body() dto: CreatePersonDto) {
    return this.svc.create(u.orgId, dto);
  }

  @Get(':id')
  @Scopes('persons:read')
  get(@CurrentUser() u: AuthContext, @Param('id') id: string) {
    return this.svc.get(u.orgId, id);
  }

  @Patch(':id')
  @Scopes('persons:write')
  update(@CurrentUser() u: AuthContext, @Param('id') id: string, @Body() dto: UpdatePersonDto) {
    return this.svc.update(u.orgId, id, dto);
  }

  @Delete(':id')
  @Scopes('persons:write')
  @HttpCode(204)
  remove(@CurrentUser() u: AuthContext, @Param('id') id: string) {
    return this.svc.remove(u.orgId, id);
  }
}
