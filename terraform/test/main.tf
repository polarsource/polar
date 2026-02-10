provider "aws" {
  region = "us-east-2"
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
