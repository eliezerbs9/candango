import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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
        endpoint,
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
}
