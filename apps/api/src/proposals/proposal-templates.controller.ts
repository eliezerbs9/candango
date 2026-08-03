import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser, type AuthContext } from '../auth/current-user.decorator';
import { ProposalTemplatesService } from './proposal-templates.service';
import { CreateProposalTemplateDto, UpdateProposalTemplateDto } from './dto/proposal-template.dto';
import { DEFAULT_THEME, PROPOSAL_BLOCK_TYPES, PROPOSAL_FONTS } from './proposal-blocks';

@UseGuards(JwtAuthGuard)
@Controller('proposal-templates')
export class ProposalTemplatesController {
  constructor(private readonly svc: ProposalTemplatesService) {}

  /** The block palette + theme options for the proposal editor. */
  @Get('meta')
  meta() {
    return { blocks: PROPOSAL_BLOCK_TYPES, fonts: PROPOSAL_FONTS, defaultTheme: DEFAULT_THEME };
  }

  @Get()
  list(@CurrentUser() u: AuthContext) {
    return this.svc.list(u.orgId);
  }

  @Get(':id')
  get(@CurrentUser() u: AuthContext, @Param('id') id: string) {
    return this.svc.get(u.orgId, id);
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@CurrentUser() u: AuthContext, @Body() dto: CreateProposalTemplateDto) {
    return this.svc.create(u.orgId, u.userId, dto);
  }

  @Post('seed-defaults')
  @UseGuards(AdminGuard)
  seed(@CurrentUser() u: AuthContext) {
    return this.svc.seedDefaults(u.orgId, u.userId);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(@CurrentUser() u: AuthContext, @Param('id') id: string, @Body() dto: UpdateProposalTemplateDto) {
    return this.svc.update(u.orgId, id, dto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @HttpCode(204)
  remove(@CurrentUser() u: AuthContext, @Param('id') id: string) {
    return this.svc.remove(u.orgId, id);
  }
}
