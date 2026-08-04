import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * The SDK adds the bucket as a subdomain (virtual-hosted style), so SPACES_ENDPOINT must be the
 * REGION endpoint without the bucket. Be forgiving: if someone sets the bucket endpoint (or the CDN
 * host), strip the bucket subdomain and drop `.cdn.` so we sign against the origin — otherwise the
 * bucket ends up doubled (candango.candango.nyc3…) and the TLS cert doesn't match.
 */
function regionEndpoint(endpoint: string, bucket: string): string {
  try {
    const u = new URL(endpoint);
    let host = u.hostname;
    if (host.startsWith(`${bucket}.`)) host = host.slice(bucket.length + 1);
    host = host.replace('.cdn.digitaloceanspaces.com', '.digitaloceanspaces.com');
    return `${u.protocol}//${host}`;
  } catch {
    return endpoint;
  }
}

/**
 * DigitalOcean Spaces (S3-compatible) object storage for uploaded files — a single shared bucket
 * for all tenants. Objects are keyed by workspace (`org-<orgId>/…`) and isolation is enforced by the
 * upload controller (it only signs keys under the caller's org). Uploads use a presigned PUT
 * (browser → Spaces direct); reads use a short-lived presigned GET, so objects stay private.
 *
 * Inert until configured: set SPACES_ENDPOINT, SPACES_REGION, SPACES_BUCKET, SPACES_KEY, SPACES_SECRET.
 */
@Injectable()
export class SpacesService {
  private readonly logger = new Logger(SpacesService.name);
  private readonly client: S3Client | null;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    const endpoint = config.get<string>('SPACES_ENDPOINT');
    const region = config.get<string>('SPACES_REGION') ?? 'us-east-1';
    const accessKeyId = config.get<string>('SPACES_KEY');
    const secretAccessKey = config.get<string>('SPACES_SECRET');
    this.bucket = config.get<string>('SPACES_BUCKET') ?? '';

    if (endpoint && accessKeyId && secretAccessKey && this.bucket) {
      this.client = new S3Client({
        endpoint: regionEndpoint(endpoint, this.bucket),
        region,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: false,
        // DO Spaces (and other non-AWS S3) reject the SDK's default flexible-checksum headers on a
        // presigned PUT — they get signed but the browser never sends them → SignatureDoesNotMatch.
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
      });
    } else {
      this.client = null;
      this.logger.log('Spaces not configured — file uploads disabled (set SPACES_* env vars).');
    }
  }

  get configured() {
    return this.client !== null;
  }

  /** Presigned PUT URL the browser uploads the file to (valid ~10 min). */
  presignPut(key: string, contentType: string) {
    if (!this.client) throw new Error('Spaces not configured');
    return getSignedUrl(this.client, new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }), {
      expiresIn: 600,
    });
  }

  /** Short-lived presigned GET URL for viewing/downloading a private object (valid 1 h). */
  presignGet(key: string) {
    if (!this.client) throw new Error('Spaces not configured');
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: 3600 });
  }

  async delete(key: string) {
    if (!this.client) return;
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  /** Download an object's bytes (server-side, e.g. to stamp/append or re-store a signed PDF). */
  async getBytes(key: string): Promise<Buffer> {
    if (!this.client) throw new Error('Spaces not configured');
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const arr = await res.Body!.transformToByteArray();
    return Buffer.from(arr);
  }

  /** Upload bytes directly (server-side), e.g. a completed/signed PDF pulled from DocuSeal. */
  async putBytes(key: string, body: Buffer, contentType: string): Promise<void> {
    if (!this.client) throw new Error('Spaces not configured');
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
  }
}
