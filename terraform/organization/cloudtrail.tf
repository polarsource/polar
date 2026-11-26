resource "aws_cloudtrail" "organization" {
  name                          = "organization"
  s3_bucket_name                = "polar-sh-organization-cloudtrail"
  is_organization_trail         = true
  is_multi_region_trail         = true
  include_global_service_events = true
  enable_log_file_validation    = true

  depends_on = [aws_organizations_organization.current]
}
