# Infrastructure (Terraform)

This directory creates the S3 bucket used for message attachments. Locally the bucket lives in MinIO from `docker-compose.yml`. The same code works against real AWS.

## Concepts

- **Provider**: a plugin that knows how to talk to one API. `provider "aws"` in [`main.tf`](main.tf) is configured with credentials, a region and, for MinIO, a custom `endpoints.s3`. `terraform init` downloads the provider declared in `required_providers`.
- **Resource**: one object managed by Terraform, written as `resource "<type>" "<name>" { … }`. For example, `aws_s3_bucket.attachments` is the bucket itself. Other resources reference it as `aws_s3_bucket.attachments.id`, which also tells Terraform to create it first.
- **Variable / output**: inputs ([`variables.tf`](variables.tf), set in `terraform.tfvars`) and values printed after apply ([`outputs.tf`](outputs.tf)).
- **State**: `terraform.tfstate` records what Terraform created. `plan` compares the code with the state and the real world and shows the difference, and `apply` makes the changes. State and `*.tfvars` are gitignored.

## Resources

| Resource | Purpose | MinIO |
|---|---|---|
| `aws_s3_bucket.attachments` | The bucket. | yes |
| `aws_s3_bucket_public_access_block.attachments` | Blocks any public access. Files are served only through presigned URLs. | no (`manage_public_access_block = false`) |
| `aws_s3_bucket_cors_configuration.attachments` | Allows browsers to upload and download directly. | no (created only if `cors_allowed_origins` is not empty; MinIO uses `MINIO_API_CORS_ALLOW_ORIGIN`) |

## Usage

```bash
cp terraform.tfvars.example terraform.tfvars
terraform init      # download the AWS provider
terraform plan      # preview changes
terraform apply     # create or update the bucket
terraform destroy   # remove it (force_destroy = true also deletes objects)
```

For real AWS, remove `s3_endpoint` from `terraform.tfvars` and use real credentials. Set `manage_public_access_block = true`, put your frontend origins in `cors_allowed_origins`, and set `force_destroy = false`.
