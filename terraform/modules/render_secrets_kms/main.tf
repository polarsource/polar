terraform {
  required_version = ">= 1.2"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.43"
    }
  }
}

# KMS key that envelope-encrypts the app's secrets at rest, plus the IAM role
# the Render backend assumes via OIDC to use it (no long-lived AWS keys).
# Design: handbook/engineering/design-documents/secrets-encryption.mdx.

variable "environment" {
  description = "Workload environment this runs in."
  type        = string

  validation {
    condition     = contains(["production", "sandbox", "test"], var.environment)
    error_message = "Must be \"production\", \"sandbox\" or \"test\"."
  }
}

variable "render_owner_id" {
  description = "Render workspace (owner) id, e.g. tea-xxxx. Used as the OIDC issuer host."
  type        = string
}

variable "render_environment_id" {
  description = "Render environment id (evm-xxxx). The role trusts every service in this environment."
  type        = string
}

variable "permissions_boundary_arn" {
  description = "Permission boundary that IAM roles in workload accounts must carry."
  type        = string
}

locals {
  oidc_host = "oidc.render.com/${var.render_owner_id}"
}

resource "aws_kms_key" "secrets" {
  description             = "Envelope encryption master key for polar-${var.environment} secrets at rest"
  enable_key_rotation     = true
  deletion_window_in_days = 30

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_kms_alias" "secrets" {
  name          = "alias/polar-${var.environment}-secrets"
  target_key_id = aws_kms_key.secrets.key_id
}

# thumbprint_list is omitted: AWS retrieves it from the issuer (aws provider
# >= 5.43). See render.com/docs/oidc.
resource "aws_iam_openid_connect_provider" "render" {
  url            = "https://${local.oidc_host}"
  client_id_list = ["sts.amazonaws.com"]
}

data "aws_iam_policy_document" "assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.render.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "${local.oidc_host}:aud"
      values   = ["sts.amazonaws.com"]
    }

    # sub is "workspace:{owner}:environment:{env}:service:{service}"; trust every
    # service in this environment only. https://render.com/docs/oidc
    condition {
      test     = "StringLike"
      variable = "${local.oidc_host}:sub"
      values   = ["workspace:${var.render_owner_id}:environment:${var.render_environment_id}:service:*"]
    }
  }
}

resource "aws_iam_role" "secrets" {
  name                 = "polar-${var.environment}-secrets"
  assume_role_policy   = data.aws_iam_policy_document.assume.json
  permissions_boundary = var.permissions_boundary_arn
}

data "aws_iam_policy_document" "secrets" {
  statement {
    sid = "EnvelopeEncryption"
    actions = [
      "kms:GenerateDataKey",
      "kms:Decrypt",
    ]
    resources = [aws_kms_key.secrets.arn]
  }
}

resource "aws_iam_role_policy" "secrets" {
  name   = "polar-${var.environment}-secrets"
  role   = aws_iam_role.secrets.id
  policy = data.aws_iam_policy_document.secrets.json
}

output "key_arn" {
  description = "Full ARN of the secrets KMS key. Passed to the app as POLAR_AWS_KMS_KEY_ID."
  value       = aws_kms_key.secrets.arn
}

output "role_arn" {
  description = "ARN of the role the Render backend assumes via OIDC. Passed to the app as AWS_ROLE_ARN."
  value       = aws_iam_role.secrets.arn
}

output "role_name" {
  description = "Name of the role the Render backend assumes via OIDC, for attaching additional policies."
  value       = aws_iam_role.secrets.name
}
