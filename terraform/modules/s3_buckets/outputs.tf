output "public_assets_bucket_id" {
  value = aws_s3_bucket.public_assets.id
}

output "public_assets_bucket_arn" {
  value = aws_s3_bucket.public_assets.arn
}

output "public_assets_bucket_regional_domain_name" {
  value = aws_s3_bucket.public_assets.bucket_regional_domain_name
}
