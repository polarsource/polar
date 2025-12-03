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

provider "cloudflare" {
}

module "s3_buckets" {
  source          = "../modules/s3_buckets"
  environment     = "test"
  allowed_origins = ["https://test.polar.sh"]
}
