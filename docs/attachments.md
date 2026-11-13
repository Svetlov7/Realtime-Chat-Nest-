# Message attachments

Messages can carry up to 10 files (an "album", like in Telegram) plus an optional text caption. Files are stored in an S3-compatible bucket (MinIO locally). They never pass through the API server: clients upload directly to S3 with presigned POST requests and download with presigned GET URLs.

## Upload flow

```
Client                          API                                 S3 / MinIO
  |  1. POST /conversations/:id/attachments/batch                      |
  |      { files: [...] }  -------->|  membership + size checks         |
  |                                 |  insert rows (status = pending)   |
  |  <------ { attachments: [{ attachmentId, upload: { url, fields } }] }
  |                                                                     |
  |  2. POST upload.url (multipart: fields + file) -------------------->|
  |                                     S3 checks exact size & type     |
  |  <------------------------------------------------------- 204 ----|
  |                                                                     |
  |  3. POST /conversations/:id/messages                                |
  |      { content?, attachmentIds } -->|  HeadObject: uploaded? size?  |-->
  |                                 |  create message + link files      |
  |                                 |  (one transaction, status = ready)|
  |  <------ message with attachments[].url                             |
  |                                                                     |
  |  4. GET /conversations/:id/messages                                 |
  |  <------ messages with fresh presigned download URLs                |
  |  5. GET attachments[].url ----------------------------------------->|
```

Requesting uploads and sending the message are separate steps, so a client can show upload progress per file and send the message only after every file is in the bucket.

## Endpoints

All endpoints require `Authorization: Bearer <accessToken>`, and the caller must be a member of the conversation.

### `POST /conversations/:conversationId/attachments/batch`

Registers 1 to 10 files and returns one presigned upload per file, in the same order as `files`.

Request:

```json
{
  "files": [
    { "fileName": "cat.png", "mimeType": "image/png", "size": 48213, "width": 800, "height": 600 },
    { "fileName": "note.ogg", "mimeType": "audio/ogg", "size": 9120, "kind": "voice", "duration": 4 },
    { "fileName": "report.pdf", "mimeType": "application/pdf", "size": 120044 }
  ]
}
```

| Field | Required | Notes |
|---|---|---|
| `fileName` | yes | 1 to 255 characters. Used as the download file name. |
| `mimeType` | yes | `type/subtype`. Must match the `Content-Type` sent to S3. |
| `size` | yes | Exact size in bytes, at most 100 MB (`S3_MAX_FILE_SIZE`). S3 rejects any other size. |
| `kind` | no | `photo`, `video`, `audio`, `voice` or `document`. Inferred from `mimeType` if omitted (see [Kinds](#kinds)). |
| `width`, `height` | no | Pixels, for photos and videos. |
| `duration` | no | Seconds, for audio, voice and video. |

Response `201`:

```json
{
  "attachments": [
    {
      "attachmentId": "5f0c…",
      "kind": "photo",
      "upload": {
        "url": "http://localhost:9000/realtime-chat-attachments",
        "fields": {
          "bucket": "realtime-chat-attachments",
          "key": "conversations/<conversationId>/5f0c…",
          "Content-Type": "image/png",
          "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
          "X-Amz-Credential": "…",
          "X-Amz-Date": "…",
          "Policy": "…",
          "X-Amz-Signature": "…"
        }
      }
    }
  ]
}
```

### Uploading a file to S3

Send a `multipart/form-data` POST to `upload.url`. Put every entry of `upload.fields` first and the `file` field **last**:

```bash
curl -X POST "$UPLOAD_URL" \
  -F bucket=… -F key=… -F Content-Type=image/png \
  -F X-Amz-Algorithm=… -F X-Amz-Credential=… -F X-Amz-Date=… \
  -F Policy=… -F X-Amz-Signature=… \
  -F file=@cat.png
```

```js
const form = new FormData();
Object.entries(upload.fields).forEach(([k, v]) => form.append(k, v));
form.append('file', file); // must be last
await fetch(upload.url, { method: 'POST', body: form }); // 204 on success
```

The upload link expires after `S3_URL_TTL_SECONDS` (15 minutes by default).

### `POST /conversations/:conversationId/messages`

```json
{ "content": "Look at this", "attachmentIds": ["5f0c…", "9a1d…"] }
```

- At least one of a non-blank `content` or `attachmentIds` is required. `content` is the caption for a message with files.
- `attachmentIds` holds 1 to 10 unique UUIDs. Their order becomes the display order of the album.
- Each attachment must have been registered by the sender in the same conversation, must not be used by another message yet, and must already be uploaded with the declared size.

Response `201`:

```json
{
  "id": "…",
  "content": "Look at this",
  "senderId": "…",
  "conversationId": "…",
  "createdAt": "2026-11-05T21:01:03.000Z",
  "attachments": [
    {
      "id": "5f0c…",
      "kind": "photo",
      "fileName": "cat.png",
      "mimeType": "image/png",
      "size": 48213,
      "width": 800,
      "height": 600,
      "duration": null,
      "url": "http://localhost:9000/realtime-chat-attachments/conversations/…?X-Amz-…"
    }
  ]
}
```

### `GET /conversations/:conversationId/messages`

The query (`limit`, `before`) is unchanged. Every message now includes `attachments` (an empty array for text-only messages). Each `url` is a presigned GET link that expires after `S3_URL_TTL_SECONDS`, so clients should fetch the list again rather than store the links. Documents are served with `Content-Disposition: attachment` and other kinds with `inline`, using the original file name.

## Kinds

| `kind` | Allowed `mimeType` | Inferred when `kind` is omitted |
|---|---|---|
| `photo` | `image/*` except `image/svg+xml` | `image/*` except SVG |
| `video` | `video/*` | `video/*` |
| `audio` | `audio/*` | `audio/*` |
| `voice` | `audio/*` | never (must be explicit) |
| `document` | anything | everything else, including SVG |

SVG is always a document because it can contain scripts and must not be rendered inline.

## Data model

Table `message_attachments` (entity [`MessageAttachment`](../src/entities/message-attachment.entity.ts), migration [`1762300000000-AddMessageAttachments`](../src/core/database/migrations/1762300000000-AddMessageAttachments.ts)):

| Column | Notes |
|---|---|
| `id` | UUID. Also the last segment of the S3 key. |
| `message_id` | `NULL` while pending. Deleting the message cascades. |
| `conversation_id`, `uploader_id` | Who registered the file and where it may be sent. |
| `s3_key` | `conversations/{conversationId}/{id}`. The original name is never part of the key. |
| `kind`, `file_name`, `mime_type`, `size`, `width`, `height`, `duration` | Metadata from the client. `size` is verified against S3 before sending. |
| `position` | Order inside the message, set when the message is sent. |
| `status` | `pending` (registered, not sent) or `ready` (linked to a message). |

The `messages.content` column now defaults to `''`, which is the stored value for a message with files and no caption.

### Stale uploads

`AttachmentsCleanupService` runs every hour. It deletes `pending` attachments older than 24 hours, both the S3 objects and the rows, in batches of 500.

## Errors

| Status | When |
|---|---|
| `400` | Validation failed: more than 10 files, unknown fields, a `size` over the limit, a `kind` that does not match `mimeType`, an empty message, or an attachment that is unknown, belongs to someone else, is already used or is not uploaded. |
| `403` | The caller is not a member of the conversation. |
| `404` | The conversation does not exist or was deleted. |
| `409` | The attachment was linked by a concurrent request while this message was being created. |
| S3 `400` / `403` | Returned directly by S3 when the upload does not match the presigned policy (wrong size or `Content-Type`) or the link has expired. |

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `S3_ENDPOINT` | `http://localhost:9000` | Endpoint the API uses for `HeadObject` and `DeleteObjects`. |
| `S3_PUBLIC_ENDPOINT` | same as `S3_ENDPOINT` | Host written into presigned URLs. It must be reachable by clients, for example when the API runs in Docker but clients do not. |
| `S3_REGION` | `us-east-1` | Any value works for MinIO. |
| `S3_BUCKET` | `realtime-chat-attachments` | Must match the Terraform `bucket_name`. |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | `minioadmin` | MinIO root credentials locally. |
| `S3_FORCE_PATH_STYLE` | `true` | Required for MinIO. Set to `false` for AWS. |
| `S3_MAX_FILE_SIZE` | `104857600` (100 MB) | Per-file limit. |
| `S3_URL_TTL_SECONDS` | `900` | Lifetime of upload and download links. |

## Local setup

```bash
docker compose up -d db minio      # MinIO API :9000, web console :9001 (minioadmin/minioadmin)

cd infra
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform apply                    # creates the attachments bucket
cd ..

npm run start:dev
```

If Terraform is not installed, you can run it through Docker. MinIO is then reached through `host.docker.internal`:

```bash
cd infra
docker run --rm -v "$PWD":/workspace -w /workspace hashicorp/terraform:1.9.8 init
docker run --rm -v "$PWD":/workspace -w /workspace hashicorp/terraform:1.9.8 \
  apply -var s3_endpoint=http://host.docker.internal:9000
```

Official `minio/minio` images are no longer published, so `docker-compose.yml` uses `chainguard/minio:latest`, a build of MinIO from source. Browser CORS for MinIO is configured on the server through `MINIO_API_CORS_ALLOW_ORIGIN` (default `*`), not per bucket.

See [`infra/README.md`](../infra/README.md) for the Terraform concepts and for running against real AWS.

## Not implemented yet

- Thumbnails and previews.
- Multipart uploads for files over 100 MB.
- Real-time delivery over WebSocket. Messages are REST only.
- A CDN in front of the bucket.
