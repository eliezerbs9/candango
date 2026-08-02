import { Body, Controller, Delete, Get, HttpCode, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser, type AuthContext } from '../auth/current-user.decorator';
import { QuickbooksOAuthService } from './quickbooks-oauth.service';
import { QuickbooksApiService } from './quickbooks-api.service';
import { CreateQbItemDto } from './dto/qb-item.dto';

@Controller('integrations/quickbooks')
export class QuickbooksController {
  constructor(
    private readonly qbo: QuickbooksOAuthService,
    private readonly api: QuickbooksApiService,
    private readonly config: ConfigService,
  ) {}

  /** Start the connect flow; returns the Intuit consent URL. (Admin/integrations:manage gating is a future refinement.) */
  @UseGuards(JwtAuthGuard)
  @Get('connect')
  async connect(@CurrentUser() u: AuthContext) {
    return { url: await this.qbo.authUrl(u.userId, u.orgId) };
  }

  /** Intuit redirects the browser here (no JWT — identity travels in `state`). */
  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('realmId') realmId: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:3000';
    const dest = (s: string) => `${appUrl}/settings/integrations?quickbooks=${s}`;
    if (error || !code || !state || !realmId) return res.redirect(dest('error'));
    try {
      await this.qbo.handleCallback(code, state, realmId);
      return res.redirect(dest('connected'));
    } catch {
      return res.redirect(dest('error'));
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  status(@CurrentUser() u: AuthContext) {
    return this.qbo.status(u.orgId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete()
  @HttpCode(204)
  disconnect(@CurrentUser() u: AuthContext) {
    return this.qbo.disconnect(u.orgId);
  }

  /** Org-level QuickBooks products/services — for the Invoicing settings catalog. */
  @UseGuards(JwtAuthGuard)
  @Get('items')
  items(@CurrentUser() u: AuthContext) {
    return this.api.listItems(u.orgId);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('items')
  createItem(@CurrentUser() u: AuthContext, @Body() dto: CreateQbItemDto) {
    return this.api.createItem(u.orgId, dto);
  }
}
