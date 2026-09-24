provider "aws" {
  alias  = "us_west_2"
  region = "us-west-2"

  default_tags {
    tags = {
      ManagedBy = "terraform"
    }
  }
}

module "production_backups" {
  source = "../modules/backups"
  providers = {
    aws         = aws.us_east_2
    aws.replica = aws.us_west_2
  }

  permissions_boundary_arn = module.permission_boundary_management.policy_arn
  uploader_role_arns = [
    "arn:aws:iam::${local.workload_accounts.production.id}:role/polar-production-backup-copy-task",
  ]
}
