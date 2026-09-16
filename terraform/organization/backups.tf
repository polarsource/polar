provider "aws" {
  alias  = "us_west_2"
  region = "us-west-2"
}

module "production_backups" {
  source = "../modules/backups"
  providers = {
    aws         = aws.us_east_2
    aws.replica = aws.us_west_2
  }

  permissions_boundary_arn = module.permission_boundary_management.policy_arn
}

moved {
  from = aws_s3_bucket.production_backups
  to   = module.production_backups.aws_s3_bucket.primary
}

moved {
  from = aws_s3_bucket_versioning.production_backups
  to   = module.production_backups.aws_s3_bucket_versioning.primary
}

moved {
  from = aws_s3_bucket_object_lock_configuration.production_backups
  to   = module.production_backups.aws_s3_bucket_object_lock_configuration.primary
}

moved {
  from = aws_s3_bucket_server_side_encryption_configuration.production_backups
  to   = module.production_backups.aws_s3_bucket_server_side_encryption_configuration.primary
}

moved {
  from = aws_s3_bucket_lifecycle_configuration.production_backups
  to   = module.production_backups.aws_s3_bucket_lifecycle_configuration.primary
}

moved {
  from = aws_iam_policy.production_polar_sh_backups
  to   = module.production_backups.aws_iam_policy.uploader
}

import {
  to = module.production_backups.aws_iam_policy.uploader
  id = "arn:aws:iam::975049931254:policy/polar-sh-backups"
}

import {
  to = module.production_backups.aws_s3_bucket.primary
  id = "polar-sh-backups"
}

import {
  to = module.production_backups.aws_s3_bucket_lifecycle_configuration.primary
  id = "polar-sh-backups"
}

import {
  to = module.production_backups.aws_s3_bucket_server_side_encryption_configuration.primary
  id = "polar-sh-backups"
}

import {
  to = module.production_backups.aws_s3_bucket_versioning.primary
  id = "polar-sh-backups"
}
