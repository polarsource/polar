terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.92"
    }

    render = {
      source  = "render-oss/render"
      version = "1.8.0"
    }
  }

  required_version = ">= 1.2"
}
