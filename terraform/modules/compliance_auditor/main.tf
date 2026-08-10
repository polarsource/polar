terraform {
  required_version = ">= 1.2"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

variable "role_name" {
  description = "Name of the IAM role the compliance platform assumes."
  type        = string
  default     = "compliance-auditor"
}

variable "policy_name" {
  description = "Name of the managed policy holding the read permissions SecurityAudit does not cover."
  type        = string
  default     = "ComplianceAuditorPermissions"
}

variable "issuer_url" {
  description = "OIDC issuer URL of the compliance platform, including scheme. Set on the hub role the platform assumes directly."
  type        = string
  default     = null
}

variable "audience" {
  description = "OIDC audience the compliance platform requests when exchanging its token for AWS credentials."
  type        = string
  default     = "sts.amazonaws.com"
}

variable "subjects" {
  description = "Allowed OIDC sub claims. Restricts access to a single tenant on the compliance platform. Required with issuer_url."
  type        = list(string)
  default     = null
}

variable "trusted_role_arn" {
  description = "ARN of the hub auditor role allowed to assume this role. Set on member account roles instead of issuer_url."
  type        = string
  default     = null
}

variable "assumable_role_arns" {
  description = "Member account auditor role ARNs the hub role may assume."
  type        = list(string)
  default     = []
}

variable "permissions_boundary_arn" {
  description = "Optional permissions boundary ARN to attach to the role."
  type        = string
  default     = null
}

locals {
  issuer_host = var.issuer_url != null ? trimsuffix(trimprefix(var.issuer_url, "https://"), "/") : null
}

resource "aws_iam_openid_connect_provider" "this" {
  count = var.issuer_url != null ? 1 : 0

  url            = var.issuer_url
  client_id_list = [var.audience]
}

data "aws_iam_policy_document" "assume_role_oidc" {
  count = var.issuer_url != null ? 1 : 0

  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.this[0].arn]
    }

    condition {
      test     = "StringEquals"
      variable = "${local.issuer_host}:aud"
      values   = [var.audience]
    }

    condition {
      test     = "StringLike"
      variable = "${local.issuer_host}:sub"
      values   = var.subjects
    }
  }
}

data "aws_iam_policy_document" "assume_role_trusted" {
  count = var.issuer_url == null ? 1 : 0

  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "AWS"
      identifiers = [var.trusted_role_arn]
    }
  }
}

data "aws_iam_policy_document" "additional_permissions" {
  statement {
    sid    = "ResourceMetadataReadAccess"
    effect = "Allow"
    actions = [
      "backup:ListBackupJobs",
      "backup:ListRecoveryPointsByResource",
      "dynamodb:ListTagsOfResource",
      "ecr:DescribeImageScanFindings",
      "ecr:DescribeImages",
      "ecr:ListTagsForResource",
      "sqs:ListQueueTags",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "OrganizationsReadAccess"
    effect = "Allow"
    actions = [
      "organizations:DescribeOrganization",
      "organizations:DescribeOrganizationalUnit",
      "organizations:ListAccounts",
      "organizations:ListAccountsForParent",
      "organizations:ListOrganizationalUnitsForParent",
      "organizations:ListRoots",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "IdentityStoreReadAccess"
    effect = "Allow"
    actions = [
      "identitystore:DescribeGroup",
      "identitystore:DescribeGroupMembership",
      "identitystore:DescribeUser",
      "identitystore:ListGroupMemberships",
      "identitystore:ListGroupMembershipsForMember",
      "identitystore:ListGroups",
      "identitystore:ListUsers",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "DenyReadingCustomerData"
    effect = "Deny"
    actions = [
      "datapipeline:EvaluateExpression",
      "datapipeline:QueryObjects",
      "rds:DownloadDBLogFilePortion",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "additional_permissions" {
  name        = var.policy_name
  description = "Read permissions the compliance platform needs beyond SecurityAudit, minus the SecurityAudit actions that expose customer data."
  policy      = data.aws_iam_policy_document.additional_permissions.json
}

resource "aws_iam_role" "this" {
  name                 = var.role_name
  description          = "Read-only access for automated compliance assessments."
  assume_role_policy   = var.issuer_url != null ? data.aws_iam_policy_document.assume_role_oidc[0].json : data.aws_iam_policy_document.assume_role_trusted[0].json
  permissions_boundary = var.permissions_boundary_arn

  lifecycle {
    precondition {
      condition     = (var.issuer_url != null) != (var.trusted_role_arn != null)
      error_message = "Set exactly one of issuer_url or trusted_role_arn."
    }
    precondition {
      condition     = var.issuer_url == null || var.subjects != null
      error_message = "subjects is required when issuer_url is set."
    }
  }
}

resource "aws_iam_role_policy_attachment" "security_audit" {
  role       = aws_iam_role.this.name
  policy_arn = "arn:aws:iam::aws:policy/SecurityAudit"
}

resource "aws_iam_role_policy_attachment" "additional_permissions" {
  role       = aws_iam_role.this.name
  policy_arn = aws_iam_policy.additional_permissions.arn
}

data "aws_iam_policy_document" "assume_roles" {
  count = length(var.assumable_role_arns) > 0 ? 1 : 0

  statement {
    effect    = "Allow"
    actions   = ["sts:AssumeRole"]
    resources = var.assumable_role_arns
  }
}

resource "aws_iam_role_policy" "assume_roles" {
  count = length(var.assumable_role_arns) > 0 ? 1 : 0

  name   = "ComplianceAuditorAssumeRoles"
  role   = aws_iam_role.this.name
  policy = data.aws_iam_policy_document.assume_roles[0].json
}
