# =============================================================================
# IAM Identity Center (SSO) Configuration
# =============================================================================

# Variable for user-to-permission-set assignments
# Configure this in Terraform Cloud as a list of objects:
# [
#   { email = "admin@polar.sh", permission_set = "admin" },
#   { email = "dev@polar.sh", permission_set = "s3_full_access" }
# ]
variable "aws_sso_user_assignments" {
  description = "List of user assignments with email and permission set name"
  type = list(object({
    email          = string
    permission_set = string # One of: admin, s3_full_access
  }))
  default = []
}

# Get the IAM Identity Center instance
data "aws_ssoadmin_instances" "main" {
  provider = aws.sso
}

locals {
  identity_store_id = tolist(data.aws_ssoadmin_instances.main.identity_store_ids)[0]
  sso_instance_arn  = tolist(data.aws_ssoadmin_instances.main.arns)[0]

  # Map permission set names to their ARNs
  permission_set_arns = {
    admin          = aws_ssoadmin_permission_set.admin.arn
    s3_full_access = aws_ssoadmin_permission_set.s3_full_access.arn
  }

  # Create a map keyed by email for the user assignments
  user_assignments_map = {
    for assignment in var.aws_sso_user_assignments :
    "${assignment.email}-${assignment.permission_set}" => assignment
  }
}

# -----------------------------------------------------------------------------
# Permission Sets
# -----------------------------------------------------------------------------

# S3 Full Access Permission Set
resource "aws_ssoadmin_permission_set" "s3_full_access" {
  provider         = aws.sso
  name             = "S3FullAccess"
  description      = "Full access to S3 buckets"
  instance_arn     = local.sso_instance_arn
  session_duration = "PT8H"
}

resource "aws_ssoadmin_managed_policy_attachment" "s3_full_access" {
  provider           = aws.sso
  instance_arn       = local.sso_instance_arn
  managed_policy_arn = "arn:aws:iam::aws:policy/AmazonS3FullAccess"
  permission_set_arn = aws_ssoadmin_permission_set.s3_full_access.arn
}

# Administrator Access Permission Set (for admin users)
resource "aws_ssoadmin_permission_set" "admin" {
  provider         = aws.sso
  name             = "AdministratorAccess"
  description      = "Full administrator access"
  instance_arn     = local.sso_instance_arn
  session_duration = "PT8H"
}

resource "aws_ssoadmin_managed_policy_attachment" "admin" {
  provider           = aws.sso
  instance_arn       = local.sso_instance_arn
  managed_policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
  permission_set_arn = aws_ssoadmin_permission_set.admin.arn
}

# -----------------------------------------------------------------------------
# Account Assignments (Dynamic)
# -----------------------------------------------------------------------------

# Look up users from Identity Store based on the variable
data "aws_identitystore_user" "users" {
  provider          = aws.sso
  for_each          = local.user_assignments_map
  identity_store_id = local.identity_store_id

  alternate_identifier {
    unique_attribute {
      attribute_path  = "UserName"
      attribute_value = each.value.email
    }
  }
}

# Create account assignments for each user-permission_set pair
resource "aws_ssoadmin_account_assignment" "user_assignments" {
  provider           = aws.sso
  for_each           = local.user_assignments_map
  instance_arn       = local.sso_instance_arn
  permission_set_arn = local.permission_set_arns[each.value.permission_set]
  principal_id       = data.aws_identitystore_user.users[each.key].user_id
  principal_type     = "USER"
  target_id          = data.aws_caller_identity.current.account_id
  target_type        = "AWS_ACCOUNT"
}

data "aws_caller_identity" "current" {}

# =============================================================================
# S3 Buckets
# =============================================================================

module "s3_buckets" {
  source          = "../modules/s3_buckets"
  environment     = "production"
  allowed_origins = ["https://polar.sh"]
}


resource "aws_s3_bucket" "backups" {
  bucket = "polar-sh-backups"
}

resource "aws_s3_bucket_lifecycle_configuration" "backups_lifecycle" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "14-days-expiration-rule"
    status = "Enabled"
    filter {}
    expiration {
      days = 14
    }
  }
}
