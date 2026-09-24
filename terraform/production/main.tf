provider "aws" {
  region = "us-east-2"

  default_tags {
    tags = {
      ManagedBy = "terraform"
    }
  }
}

provider "render" {
}

provider "vercel" {
}
