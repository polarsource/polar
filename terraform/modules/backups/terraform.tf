terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = ">= 6.61"
      configuration_aliases = [aws.replica]
    }
  }
}
