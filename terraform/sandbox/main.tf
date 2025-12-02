provider "aws" {
  region = "us-east-2"
}

# IAM Identity Center is only available in one region per organization.
# Change this if your Identity Center is in a different region.
provider "aws" {
  alias  = "sso"
  region = "us-east-1"
}

provider "render" {
}

module "s3_buckets" {
  source                   = "../modules/s3_buckets"
  environment              = "sandbox"
  allowed_origins          = ["https://sandbox.polar.sh"]
  public_files_bucket_name = "polar-public-sandbox-files"
}

import {
  to = module.sandbox.render_env_group.apple
  id = "evg-d4ecbqn5r7bs73fn1se0"
}

import {
  to = module.sandbox.render_env_group.aws_s3
  id = "evg-crkocfrtq21c73ddsc30"
}

import {
  to = module.sandbox.render_env_group.backend
  id = "evg-crkocfrtq21c73ddsbvg"
}

import {
  to = module.sandbox.render_env_group.github
  id = "evg-crkocfrtq21c73ddsc90"
}

import {
  to = module.sandbox.render_env_group.google
  id = "evg-crkocfrtq21c73ddsbv0"
}

import {
  to = module.sandbox.render_env_group.openai
  id = "evg-d2at9pje5dus73c0lun0"
}

import {
  to = module.sandbox.render_env_group.stripe
  id = "evg-crkocfrtq21c73ddsc9g"
}

import {
  to = module.sandbox.render_env_group.prometheus[0]
  id = "evg-d4nf3qili9vc73fi984g"
}

import {
  to = module.sandbox.render_env_group_link.apple
  id = "evg-d4ecbqn5r7bs73fn1se0"
}

import {
  to = module.sandbox.render_env_group_link.aws_s3
  id = "evg-crkocfrtq21c73ddsc30"
}

import {
  to = module.sandbox.render_env_group_link.backend
  id = "evg-crkocfrtq21c73ddsbvg"
}

import {
  to = module.sandbox.render_env_group_link.github
  id = "evg-crkocfrtq21c73ddsc90"
}

import {
  to = module.sandbox.render_env_group_link.google
  id = "evg-crkocfrtq21c73ddsbv0"
}

import {
  to = module.sandbox.render_env_group_link.openai
  id = "evg-d2at9pje5dus73c0lun0"
}

import {
  to = module.sandbox.render_env_group_link.stripe
  id = "evg-crkocfrtq21c73ddsc9g"
}

import {
  to = module.sandbox.render_web_service.api
  id = "srv-crkocgbtq21c73ddsdbg"
}

import {
  to = module.sandbox.render_web_service.worker["worker-sandbox"]
  id = "srv-d089jj7diees73934kgg"
}

import {
  to = module.s3_buckets.aws_s3_bucket.public_files
  id = "polar-public-sandbox-files"
}

import {
  to = module.s3_buckets.aws_s3_bucket_cors_configuration.public_files
  id = "polar-public-sandbox-files"
}

import {
  to = module.s3_buckets.aws_s3_bucket_policy.public_files
  id = "polar-public-sandbox-files"
}

import {
  to = module.s3_buckets.aws_s3_bucket_public_access_block.public_files
  id = "polar-public-sandbox-files"
}
