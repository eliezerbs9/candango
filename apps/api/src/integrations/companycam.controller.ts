import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthContext } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { DealEventsService } from '../deal-events/deal-events.service';
import { CompanyCamOAuthService } from './companycam-oauth.service';
import { CompanyCamApiService } from './companycam-api.service';

/** The deal's job-site address is stored as JSON ({ line1, city, state, … }) — flatten it. */
function addressLine(shipTo: unknown): string | null {
  const a = (shipTo ?? {}) as Record<string, string>;
  const line = [a.line1, a.line2, a.city, a.state, a.postalCode].filter(Boolean).join(', ');
  return line || null;
}

@Controller('integrations/companycam')
export class CompanyCamController {
  constructor(
    private readonly oauth: CompanyCamOAuthService,
    private readonly api: CompanyCamApiService,
    private readonly prisma: PrismaService,
    private readonly events: DealEventsService,
    private readonly config: ConfigService,
  ) {}

  /** Start the connect flow; returns the CompanyCam consent URL. */
  @UseGuards(JwtAuthGuard)
  @Get('connect')
  async connect(@CurrentUser() u: AuthContext) {
    return { url: await this.oauth.authUrl(u.userId, u.orgId) };
  }

  /** CompanyCam redirects the browser here (no JWT — identity travels in the signed `state`). */
  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:3000';
    const dest = (s: string) => `${appUrl}/settings/integrations?companycam=${s}`;
    if (error || !code || !state) return res.redirect(dest('error'));
    try {
      await this.oauth.handleCallback(code, state);
      return res.redirect(dest('connected'));
    } catch {
      return res.redirect(dest('error'));
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  status(@CurrentUser() u: AuthContext) {
    return this.oauth.status(u.orgId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete()
  @HttpCode(204)
  disconnect(@CurrentUser() u: AuthContext) {
    return this.oauth.disconnect(u.orgId);
  }

  /** Search the workspace's CompanyCam projects — powers the deal picker and the de-dup check. */
  @UseGuards(JwtAuthGuard)
  @Get('projects')
  projects(@CurrentUser() u: AuthContext, @Query('q') q?: string) {
    return this.api.listProjects(u.orgId, q);
  }

  /** What this deal is linked to (if anything). */
  @UseGuards(JwtAuthGuard)
  @Get('deals/:dealId')
  async dealLink(@CurrentUser() u: AuthContext, @Param('dealId') dealId: string) {
    const link = await this.prisma.companyCamProjectLink.findFirst({ where: { orgId: u.orgId, dealId } });
    return { link: link ? { projectId: link.projectId, projectName: link.projectName } : null };
  }

  /** The linked project's photos, straight from CompanyCam (nothing is copied into our storage). */
  @UseGuards(JwtAuthGuard)
  @Get('deals/:dealId/photos')
  async dealPhotos(@CurrentUser() u: AuthContext, @Param('dealId') dealId: string) {
    const link = await this.prisma.companyCamProjectLink.findFirst({ where: { orgId: u.orgId, dealId } });
    if (!link) return { photos: [] };
    return { photos: await this.api.listPhotos(u.orgId, link.projectId) };
  }

  /** Link an existing CompanyCam project to the deal. */
  @UseGuards(JwtAuthGuard)
  @Post('deals/:dealId/link')
  async link(
    @CurrentUser() u: AuthContext,
    @Param('dealId') dealId: string,
    @Body() body: { projectId?: string; projectName?: string },
  ) {
    const projectId = body.projectId?.trim();
    if (!projectId) throw new BadRequestException('projectId is required');
    await this.assertDeal(u.orgId, dealId);

    const link = await this.prisma.companyCamProjectLink.upsert({
      where: { dealId },
      create: { orgId: u.orgId, dealId, projectId, projectName: body.projectName ?? null },
      update: { projectId, projectName: body.projectName ?? null },
    });
    await this.events.log(u.orgId, dealId, {
      kind: 'automation',
      title: 'CompanyCam project linked',
      body: link.projectName ?? projectId,
      actor: await this.actorName(u.userId),
    });
    return { projectId: link.projectId, projectName: link.projectName };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('deals/:dealId/link')
  async unlink(@CurrentUser() u: AuthContext, @Param('dealId') dealId: string) {
    await this.prisma.companyCamProjectLink.deleteMany({ where: { orgId: u.orgId, dealId } });
    await this.events.log(u.orgId, dealId, {
      kind: 'automation',
      title: 'CompanyCam project unlinked',
      actor: await this.actorName(u.userId),
    });
    return { ok: true };
  }

  /**
   * Create a CompanyCam project from the deal and link it. Callers should offer any near-duplicate
   * from `GET /projects?q=` first — this endpoint creates what it is asked to create.
   */
  @UseGuards(JwtAuthGuard)
  @Post('deals/:dealId/project')
  async createProject(@CurrentUser() u: AuthContext, @Param('dealId') dealId: string) {
    const deal = await this.assertDeal(u.orgId, dealId);
    const existing = await this.prisma.companyCamProjectLink.findFirst({ where: { orgId: u.orgId, dealId } });
    if (existing) throw new BadRequestException('This deal is already linked to a CompanyCam project');

    const project = await this.api.createProject(u.orgId, { name: deal.title, address: addressLine(deal.shipTo) });
    await this.prisma.companyCamProjectLink.create({
      data: { orgId: u.orgId, dealId, projectId: project.id, projectName: project.name },
    });
    await this.events.log(u.orgId, dealId, {
      kind: 'automation',
      title: 'CompanyCam project created',
      body: project.name,
      actor: await this.actorName(u.userId),
    });
    return project;
  }

  /** Tenant check that doesn't rely on RLS alone, and gives us the fields used to name a project. */
  private async assertDeal(orgId: string, dealId: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id: dealId, orgId },
      select: { id: true, title: true, shipTo: true },
    });
    if (!deal) throw new BadRequestException('Deal not found');
    return deal;
  }

  /** Timeline actors are human-readable names ("Ana Souza"), never ids. */
  private async actorName(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId },
      select: { firstName: true, lastName: true, email: true },
    });
    if (!user) return null;
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    return name || user.email;
  }
}
