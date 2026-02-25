output "public_assets_bucket_id" {
  value = aws_s3_bucket.public_assets.id
}

output "public_assets_bucket_arn" {
  value = aws_s3_bucket.public_assets.arn
}

output "public_assets_bucket_regional_domain_name" {
  value = aws_s3_bucket.public_assets.bucket_regional_domain_name
}

output "public_files_bucket_id" {
  value = aws_s3_bucket.public_files.id
}

output "public_files_bucket_arn" {
  value = aws_s3_bucket.public_files.arn
}

output "public_files_bucket_regional_domain_name" {
  value = aws_s3_bucket.public_files.bucket_regional_domain_name
}
