terraform {
  required_providers {
    polar = {
      source  = "polarsource/polar"
      version = "~> 0.1"
    }
  }
}

provider "polar" {
  # access_token can also come from the POLAR_ACCESS_TOKEN environment variable.
  # server = "sandbox" targets the sandbox environment (separate tokens!).
}
