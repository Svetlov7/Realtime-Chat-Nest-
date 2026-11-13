output "bucket_name" {
  description = "Attachments bucket name (use as S3_BUCKET)."
  value       = aws_s3_bucket.attachments.bucket
}

output "bucket_arn" {
  description = "Attachments bucket ARN."
  value       = aws_s3_bucket.attachments.arn
}
