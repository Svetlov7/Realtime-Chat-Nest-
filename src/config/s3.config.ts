import { registerAs } from '@nestjs/config';

export interface S3Config {
  endpoint: string;
  publicEndpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  maxFileSize: number;
  urlTtlSeconds: number;
}

export default registerAs('s3', (): S3Config => {
  const endpoint = process.env.S3_ENDPOINT ?? 'http://localhost:9000';
  return {
    endpoint,
    publicEndpoint: process.env.S3_PUBLIC_ENDPOINT ?? endpoint,
    region: process.env.S3_REGION ?? 'us-east-1',
    bucket: process.env.S3_BUCKET ?? 'realtime-chat-attachments',
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? 'minioadmin',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
    maxFileSize: Number(process.env.S3_MAX_FILE_SIZE ?? 100 * 1024 * 1024),
    urlTtlSeconds: Number(process.env.S3_URL_TTL_SECONDS ?? 900),
  };
});
