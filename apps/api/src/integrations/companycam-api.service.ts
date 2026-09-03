import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { decryptToken, encryptToken } from './crypto.util';
import { CompanyCamOAuthService, CompanyCamTokenError } from './companycam-oauth.service';

/** Renew this long before the token actually expires, so an in-flight request never 401s. */
const REFRESH_SKEW_MS = 5 * 60 * 1000;
const NOT_CONNECTED = 'CompanyCam is not connected for this workspace';

/** A photo, normalized out of CompanyCam's `uris` array into what the UI needs. */
export interface CompanyCamPhoto {
  id: string;
  url: string; // web-sized
  thumbnailUrl: string;
  capturedAt: string | null;
  creator: string | null;
}

export interface CompanyCamProject {
  id: string;
  name: string;
  address: string | null;
  photoCount: number | null;
}

interface RawUri {
  type?: string;
  url?: string;
}
interface RawPhoto {
  id?: string | number;
  uris?: RawUri[];
  captured_at?: number | string;
  creator_name?: string;
}
interface RawProject {
  id?: string | number;
  name?: string;
  address?: { street_address_1?: string; city?: string; state?: string };
  photo_count?: number;
}

/**
 * CompanyCam REST client with refresh-on-use. One connection per org.
 *
 * The base URL is configurable because CompanyCam is mid-migration: `api.companycam.com/v2` is the
 * current (legacy) API, whose support ends 2027-09-01, and the replacement lives on the new
 * developer platform. Moving over should be a config change plus response mapping, not a rewrite.
 */
@Injectable()
export class CompanyCamApiService {
  private readonly logger = new Logger(CompanyCamApiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly oauth: CompanyCamOAuthService,
  ) {}

  private baseUrl() {
    return (this.config.get<string>('COMPANYCAM_API_URL') ?? 'https://api.companycam.com/v2').replace(/\/+$/, '');
  }

  /** A valid access token, refreshing first when it is at/near expiry. */
  private async accessToken(orgId: string): Promise<string> {
    const conn = await this.prisma.companyCamConnection.findUnique({ where: { orgId } });
    if (!conn || conn.status !== 'connected') throw new BadRequestException(NOT_CONNECTED);

    const stale = !conn.tokenExpiry || conn.tokenExpiry.getTime() < Date.now() + REFRESH_SKEW_MS;
    if (!stale) return decryptToken(conn.accessToken);

    try {
      return await this.refreshLocked(orgId);
    } catch (e) {
      // A rejected grant means the workspace must reconnect; anything else is transient and must
      // NOT drop a working connection (a network blip shouldn't log everyone out of CompanyCam).
      const fatal = e instanceof CompanyCamTokenError && (e.httpStatus === 400 || e.httpStatus === 401);
      const message = e instanceof Error ? e.message.slice(0, 300) : 'CompanyCam token refresh failed';
      await this.prisma.companyCamConnection.update({
        where: { orgId },
        data: { lastError: message, ...(fatal ? { status: 'reauth_required' } : {}) },
      });
      this.logger.warn(`CompanyCam refresh failed for org ${orgId}: ${message}`);
      throw new BadRequestException(fatal ? 'CompanyCam needs to be reconnected' : 'CompanyCam token refresh failed');
    }
  }

  /**
   * Refresh under a row lock.
   *
   * CompanyCam rotates the refresh token on every use: the old one dies the moment a new pair is
   * issued. Two requests refreshing at once would each invalidate the other's token and knock the
   * workspace offline — so the row is locked with `FOR UPDATE`, and whoever loses the race re-reads
   * the token the winner just stored instead of asking for another one. The HTTP call happens while
   * the lock is held; that's a few hundred ms at most once every ~2 hours per workspace.
   */
  private async refreshLocked(orgId: string): Promise<string> {
    return this.prisma.$tx(async (tx) => {
      const rows = await tx.$queryRaw<
        { accessToken: string; refreshToken: string; tokenExpiry: Date | null; status: string }[]
      >`SELECT "accessToken", "refreshToken", "tokenExpiry", "status"
          FROM "CompanyCamConnection" WHERE "orgId" = ${orgId} FOR UPDATE`;
      const row = rows[0];
      if (!row || row.status !== 'connected') throw new BadRequestException(NOT_CONNECTED);

      // Someone else refreshed while we waited for the lock — use their token.
      if (row.tokenExpiry && row.tokenExpiry.getTime() > Date.now() + REFRESH_SKEW_MS) {
        return decryptToken(row.accessToken);
      }

      const t = await this.oauth.exchange({
        grant_type: 'refresh_token',
        refresh_token: decryptToken(row.refreshToken),
      });
      await tx.companyCamConnection.update({
        where: { orgId },
        data: {
          accessToken: encryptToken(t.access_token),
          refreshToken: encryptToken(t.refresh_token), // rotated — the old one is already dead
          tokenExpiry: new Date(Date.now() + (t.expires_in ?? 7200) * 1000),
          lastRefreshAt: new Date(),
          status: 'connected',
          lastError: null,
        },
      });
      return t.access_token;
    });
  }

  /** Authenticated request with retry on 429 (CompanyCam rate-limits bulk photo reads). */
  private async request<T>(orgId: string, method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const token = await this.accessToken(orgId);
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(`${this.baseUrl()}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.status === 429 && attempt < 3) {
        const retryAfter = Number(res.headers.get('retry-after'));
        await new Promise((r) => setTimeout(r, retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 1000));
        continue;
      }
      const text = await res.text().catch(() => '');
      if (!res.ok) {
        if (res.status === 401) {
          await this.prisma.companyCamConnection.update({
            where: { orgId },
            data: { status: 'reauth_required', lastError: 'CompanyCam rejected the access token' },
          });
          throw new BadRequestException('CompanyCam needs to be reconnected');
        }
        throw new BadRequestException(`CompanyCam ${res.status}: ${text.slice(0, 200)}`);
      }
      return (text ? JSON.parse(text) : {}) as T;
    }
  }

  private static mapProject(p: RawProject): CompanyCamProject {
    const a = p.address;
    const address = a ? [a.street_address_1, a.city, a.state].filter(Boolean).join(', ') : '';
    return { id: String(p.id ?? ''), name: p.name ?? '(untitled)', address: address || null, photoCount: p.photo_count ?? null };
  }

  /** Search the workspace's projects (used by the deal picker and by de-dup before creating). */
  async listProjects(orgId: string, query?: string): Promise<CompanyCamProject[]> {
    const params = new URLSearchParams({ per_page: '25' });
    if (query?.trim()) params.set('query', query.trim());
    const raw = await this.request<RawProject[]>(orgId, 'GET', `/projects?${params.toString()}`);
    return (Array.isArray(raw) ? raw : []).map(CompanyCamApiService.mapProject);
  }

  async createProject(orgId: string, input: { name: string; address?: string | null }): Promise<CompanyCamProject> {
    const raw = await this.request<RawProject>(orgId, 'POST', '/projects', {
      project: { name: input.name, ...(input.address ? { address: { street_address_1: input.address } } : {}) },
    });
    return CompanyCamApiService.mapProject(raw);
  }

  /** A project's photos, newest first. URLs are served straight from CompanyCam — nothing is copied. */
  async listPhotos(orgId: string, projectId: string): Promise<CompanyCamPhoto[]> {
    const raw = await this.request<RawPhoto[]>(orgId, 'GET', `/projects/${encodeURIComponent(projectId)}/photos?per_page=50`);
    return (Array.isArray(raw) ? raw : []).map((p) => {
      const byType = (t: string) => p.uris?.find((u) => u.type === t)?.url;
      const url = byType('web') ?? byType('original') ?? byType('thumbnail') ?? '';
      return {
        id: String(p.id ?? ''),
        url,
        thumbnailUrl: byType('thumbnail') ?? url,
        capturedAt: p.captured_at ? new Date(Number(p.captured_at) * 1000).toISOString() : null,
        creator: p.creator_name ?? null,
      };
    });
  }
}
