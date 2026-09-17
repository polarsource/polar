terraform {
  required_version = ">= 1.2"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.43"
    }
  }
}

# Asymmetric KMS keys that sign OAuth2 id_tokens and SSO client assertions.
#
# One key per generation: KMS rotates symmetric encryption keys only, so
# rotating this one means publishing another and moving the pointer. See
# ADR-0010 and handbook/engineering/oncall/rotate-jwks.mdx.

variable "environment" {
  description = "Workload environment this runs in."
  type        = string

  validation {
    condition     = contains(["production", "sandbox", "test"], var.environment)
    error_message = "Must be \"production\", \"sandbox\" or \"test\"."
  }
}

variable "role_name" {
  description = "IAM role the app runs as, granted signing on this key."
  type        = string
}

variable "generations" {
  description = "One KMS key per generation. All are published; only the current one signs."
  type        = list(string)
}

variable "current_generation" {
  description = "Generation that signs now. Must appear in generations."
  type        = string
}

# No prevent_destroy: retiring a generation has to destroy its key.
# deletion_window_in_days is the guard — KMS schedules deletion 30 days out.
resource "aws_kms_key" "signing" {
  for_each = toset(var.generations)

  description              = "JWKS signing key ${each.key} for polar-${var.environment}"
  key_usage                = "SIGN_VERIFY"
  customer_master_key_spec = "RSA_2048"
  deletion_window_in_days  = 30
}

# The first generation predates for_each; can go once every environment has applied.
moved {
  from = aws_kms_key.signing
  to   = aws_kms_key.signing["2026-09"]
}

resource "aws_kms_alias" "signing" {
  name          = "alias/polar-${var.environment}-jwks"
  target_key_id = aws_kms_key.signing[var.current_generation].key_id
}

data "aws_iam_policy_document" "signing" {
  statement {
    sid       = "Sign"
    actions   = ["kms:Sign"]
    resources = [aws_kms_key.signing[var.current_generation].arn]
  }

  statement {
    sid       = "Publish"
    actions   = ["kms:GetPublicKey"]
    resources = [for key in aws_kms_key.signing : key.arn]
  }
}

resource "aws_iam_role_policy" "signing" {
  name   = "polar-${var.environment}-jwks-signing"
  role   = var.role_name
  policy = data.aws_iam_policy_document.signing.json
}

output "current_key_arn" {
  description = "ARN of the generation that signs now. Passed to the app as POLAR_AWS_JWKS_KMS_KEY_ID."
  value       = aws_kms_key.signing[var.current_generation].arn
}

output "published_key_arns" {
  description = "ARNs of every generation, the current one included. Passed to the app as POLAR_AWS_JWKS_KMS_PUBLISHED_KEY_IDS."
  value       = [for key in aws_kms_key.signing : key.arn]
}
