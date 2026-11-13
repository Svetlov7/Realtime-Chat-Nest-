import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { S3Config } from '../config/s3.config.js';

export interface PresignedUpload {
  url: string;
  fields: Record<string, string>;
}

@Injectable()
export class StorageService {
  private readonly config: S3Config;
  // Server-side calls go to the internal endpoint; presigned URLs must be
  // signed for the host the client will actually hit.
  private readonly client: S3Client;
  private readonly publicClient: S3Client;

  constructor(configService: ConfigService) {
    this.config = configService.getOrThrow<S3Config>('s3');
    this.client = this.createClient(this.config.endpoint);
    this.publicClient = this.createClient(this.config.publicEndpoint);
  }

  get maxFileSize(): number {
    return this.config.maxFileSize;
  }

  createUpload(
    key: string,
    contentType: string,
    size: number,
  ): Promise<PresignedUpload> {
    return createPresignedPost(this.publicClient, {
      Bucket: this.config.bucket,
      Key: key,
      Fields: { 'Content-Type': contentType },
      Conditions: [
        ['content-length-range', size, size],
        ['eq', '$Content-Type', contentType],
      ],
      Expires: this.config.urlTtlSeconds,
    });
  }

  /** Returns the stored object size, or null if the object does not exist. */
  async getObjectSize(key: string): Promise<number | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }),
      );
      return result.ContentLength ?? null;
    } catch (error) {
      if ((error as { name?: string }).name === 'NotFound') {
        return null;
      }
      throw error;
    }
  }

  getDownloadUrl(
    key: string,
    fileName: string,
    disposition: 'inline' | 'attachment',
  ): Promise<string> {
    return getSignedUrl(
      this.publicClient,
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        ResponseContentDisposition: `${disposition}; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      }),
      { expiresIn: this.config.urlTtlSeconds },
    );
  }

  async deleteObjects(keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }
    await this.client.send(
      new DeleteObjectsCommand({
        Bucket: this.config.bucket,
        Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
      }),
    );
  }

  private createClient(endpoint: string): S3Client {
    return new S3Client({
      endpoint,
      region: this.config.region,
      forcePathStyle: this.config.forcePathStyle,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
    });
  }
}
