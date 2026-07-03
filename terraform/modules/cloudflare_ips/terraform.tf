terraform {
  required_version = ">= 1.2"

  required_providers {
    http = {
      source  = "hashicorp/http"
      version = ">= 3.0"
    }
  }
}
