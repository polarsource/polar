terraform {
  required_version = ">= 1.2"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.43"
    }
  }
}

# Asymmetric KMS key that signs OAuth2 id_tokens and SSO client assertions. The
# private key never leaves KMS; the app signs through kms:Sign and publishes the
# public half from kms:GetPublicKey.
#
# No enable_key_rotation here: KMS supports automatic rotation only for
# symmetric encryption keys. Rotating this one means creating a second key and
# moving the published set over to it — see ADR-0010.

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

resource "aws_kms_key" "signing" {
  description              = "JWKS signing key for polar-${var.environment}"
  key_usage                = "SIGN_VERIFY"
  customer_master_key_spec = "RSA_2048"
  deletion_window_in_days  = 30

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_kms_alias" "signing" {
  name          = "alias/polar-${var.environment}-jwks"
  target_key_id = aws_kms_key.signing.key_id
}

data "aws_iam_policy_document" "signing" {
  statement {
    sid = "SignAndPublish"
    actions = [
      "kms:Sign",
      "kms:GetPublicKey",
    ]
    resources = [aws_kms_key.signing.arn]
  }
}

resource "aws_iam_role_policy" "signing" {
  name   = "polar-${var.environment}-jwks-signing"
  role   = var.role_name
  policy = data.aws_iam_policy_document.signing.json
}

output "key_arn" {
  description = "Full ARN of the JWKS signing key. Passed to the app as POLAR_AWS_JWKS_KMS_KEY_ID."
  value       = aws_kms_key.signing.arn
}
