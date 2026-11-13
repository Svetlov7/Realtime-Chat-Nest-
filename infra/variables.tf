variable "region" {
  description = "AWS region (any value works for MinIO)."
  type        = string
  default     = "us-east-1"
}

variable "access_key" {
  description = "S3 access key (MinIO root user locally)."
  type        = string
  sensitive   = true
}

variable "secret_key" {
  description = "S3 secret key (MinIO root password locally)."
  type        = string
  sensitive   = true
}

variable "s3_endpoint" {
  description = "Custom S3 endpoint, e.g. http://localhost:9000 for MinIO. Leave null for real AWS."
  type        = string
  default     = null
}

variable "bucket_name" {
  description = "Name of the attachments bucket. Must match S3_BUCKET in the app's .env."
  type        = string
  default     = "realtime-chat-attachments"
}

variable "force_destroy" {
  description = "Allow terraform destroy to delete a non-empty bucket."
  type        = bool
  default     = false
}

variable "manage_public_access_block" {
  description = "Create the public access block. MinIO does not support this API, so disable it there."
  type        = bool
  default     = true
}

variable "cors_allowed_origins" {
  description = "Origins allowed to upload from a browser. Empty skips bucket CORS (required for MinIO)."
  type        = list(string)
  default     = []
}
