terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# The AWS provider talks to the S3 API. Locally it points at MinIO, so all
# AWS-account checks are skipped and requests use path-style URLs.
provider "aws" {
  region     = var.region
  access_key = var.access_key
  secret_key = var.secret_key

  s3_use_path_style           = var.s3_endpoint != null
  skip_credentials_validation = var.s3_endpoint != null
  skip_requesting_account_id  = var.s3_endpoint != null
  skip_metadata_api_check     = var.s3_endpoint != null
  skip_region_validation      = var.s3_endpoint != null

  endpoints {
    s3 = var.s3_endpoint
  }
}

resource "aws_s3_bucket" "attachments" {
  bucket        = var.bucket_name
  force_destroy = var.force_destroy
}

# Attachments are private; clients only get short-lived presigned URLs.
resource "aws_s3_bucket_public_access_block" "attachments" {
  count  = var.manage_public_access_block ? 1 : 0
  bucket = aws_s3_bucket.attachments.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# MinIO has no per-bucket CORS (it is set on the server via
# MINIO_API_CORS_ALLOW_ORIGIN), so this is only created for real AWS.
resource "aws_s3_bucket_cors_configuration" "attachments" {
  count  = length(var.cors_allowed_origins) > 0 ? 1 : 0
  bucket = aws_s3_bucket.attachments.id

  cors_rule {
    allowed_methods = ["GET", "POST", "HEAD"]
    allowed_origins = var.cors_allowed_origins
    allowed_headers = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}
