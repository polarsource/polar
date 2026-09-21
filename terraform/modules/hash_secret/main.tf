terraform {
  required_version = ">= 1.2"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.43"
    }
  }
}

# The secret that peppers every token hash.
#
# One version per secret, AWSCURRENT on the one new hashes use, and a custom
# staging label per version carrying the id that prefixes them. See
# handbook/engineering/oncall/rotate-secret.mdx.
#
# Never an aws_secretsmanager_secret_version here: it would put the value in
# Terraform Cloud state in plaintext, which is what this replaces.

variable "environment" {
  description = "Workload environment this runs in."
  type        = string

  validation {
    condition     = contains(["production", "sandbox", "test"], var.environment)
    error_message = "Must be \"production\", \"sandbox\" or \"test\"."
  }
}

variable "role_name" {
  description = "IAM role the app runs as, granted read on this secret."
  type        = string
}

# No rotation_rules: built-in rotation retires versions on a timer, and AWS
# cannot see the tail query that says when that is safe.
resource "aws_secretsmanager_secret" "hash" {
  name        = "polar-${var.environment}-hash-secret"
  description = "Token hashing secrets for polar-${var.environment}, one per version"
}

data "aws_iam_policy_document" "hash" {
  statement {
    sid = "ReadEveryVersion"
    actions = [
      "secretsmanager:GetSecretValue",
      "secretsmanager:ListSecretVersionIds",
    ]
    resources = [aws_secretsmanager_secret.hash.arn]
  }
}

resource "aws_iam_role_policy" "hash" {
  name   = "polar-${var.environment}-hash-secret"
  role   = var.role_name
  policy = data.aws_iam_policy_document.hash.json
}

output "secret_arn" {
  description = "ARN of the secret. Passed to the app as POLAR_AWS_HASH_SECRET_ARN."
  value       = aws_secretsmanager_secret.hash.arn
}
