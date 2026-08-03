import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Post, Query, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthContext } from '../auth/current-user.decorator';
import { SpacesService } from './spaces.service';

const ENTITIES = ['deal', 'person', 'company'];

/**
 * Presigned file uploads for image/document custom fields, backed by DO Spaces. Objects are keyed by
 * the caller's org (`org-<orgId>/…`); every operation verifies that prefix, so a workspace can only
 * touch its own files even though the bucket is shared.
 */
@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly spaces: SpacesService) {}

  @Get('status')
  status() {
    return { configured: this.spaces.configured };
  }

  /** Get a presigned PUT URL + the object key to store on the record. */
  @Post('presign')
  async presign(
    @CurrentUser() u: AuthContext,
    @Body() body: { entity?: string; filename?: string; contentType?: string },
  ) {
    if (!this.spaces.configured) throw new ServiceUnavailableException('File storage is not configured');
    const entity = ENTITIES.includes(body.entity ?? '') ? body.entity : 'deal';
    const contentType = (body.contentType ?? '').trim() || 'application/octet-stream';
    const safeName = (body.filename ?? 'file')
      .replace(/[^\w.\- ]/g, '_')
      .replace(/\s+/g, '_')
      .slice(-80);
    const key = `org-${u.orgId}/${entity}/${randomUUID()}-${safeName}`;
    const uploadUrl = await this.spaces.presignPut(key, contentType);
    return { key, uploadUrl };
  }

  /** Short-lived signed URL to view/download a stored object (org-scoped). */
  @Get('url')
  async url(@CurrentUser() u: AuthContext, @Query('key') key: string) {
    this.assertOwned(u.orgId, key);
    return { url: await this.spaces.presignGet(key) };
  }

  @Delete()
  async remove(@CurrentUser() u: AuthContext, @Query('key') key: string) {
    this.assertOwned(u.orgId, key);
    await this.spaces.delete(key);
    return { ok: true };
  }

  private assertOwned(orgId: string, key: string) {
    if (!key) throw new BadRequestException('Missing key');
    if (!key.startsWith(`org-${orgId}/`)) throw new ForbiddenException('Not your file');
  }
}
