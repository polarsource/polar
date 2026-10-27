terraform {
  required_version = ">= 1.2"

  required_providers {
    planetscale = {
      source  = "planetscale/planetscale"
      version = ">= 1.14"
    }
  }
}
