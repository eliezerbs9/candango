import { Controller, Delete, Get, HttpCode, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthContext } from '../auth/current-user.decorator';
import { GoogleOAuthService } from './google-oauth.service';

@Controller('integrations/google')
export class IntegrationsController {
  constructor(
    private readonly google: GoogleOAuthService,
    private readonly config: ConfigService,
  ) {}

  /** Returns the Google consent URL; the frontend redirects the browser to it. */
  @UseGuards(JwtAuthGuard)
  @Get('connect')
  async connect(@CurrentUser() u: AuthContext) {
    return { url: await this.google.authUrl(u.userId, u.orgId) };
  }

  /** Google redirects the browser here (no JWT — identity travels in `state`). */
  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:3000';
    const dest = (status: string) => `${appUrl}/settings/integrations?google=${status}`;
    if (error || !code || !state) return res.redirect(dest('error'));
    try {
      await this.google.handleCallback(code, state);
      return res.redirect(dest('connected'));
    } catch {
      return res.redirect(dest('error'));
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  status(@CurrentUser() u: AuthContext) {
    return this.google.status(u.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete()
  @HttpCode(204)
  disconnect(@CurrentUser() u: AuthContext) {
    return this.google.disconnect(u.userId);
  }

  /** Trigger a Gmail capture for the current user (also runs on connect + on a poll). */
  @UseGuards(JwtAuthGuard)
  @Post('sync-email')
  @HttpCode(202)
  async syncEmail(@CurrentUser() u: AuthContext) {
    await this.google.syncEmail(u.userId);
    return { queued: true };
  }
}
