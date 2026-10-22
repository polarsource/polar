terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = ">= 6.69.1, < 7.0.0"
      configuration_aliases = [aws.replica]
    }
  }
}
