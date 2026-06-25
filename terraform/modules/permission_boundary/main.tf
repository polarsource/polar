terraform {
  required_version = ">= 1.2"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

variable "policy_name" {
  description = "Name of the permission boundary managed policy."
  type        = string
  default     = "PolarPermissionBoundary"
}

data "aws_caller_identity" "current" {}

data "aws_partition" "current" {}

locals {
  boundary_arn = "arn:${data.aws_partition.current.partition}:iam::${data.aws_caller_identity.current.account_id}:policy/${var.policy_name}"
}

data "aws_iam_policy_document" "boundary" {
  statement {
    sid       = "AllowAllByDefault"
    effect    = "Allow"
    actions   = ["*"]
    resources = ["*"]
  }

  statement {
    sid    = "DenyCreatingPrincipalsWithoutBoundary"
    effect = "Deny"
    actions = [
      "iam:CreateRole",
      "iam:CreateUser",
      "iam:PutRolePermissionsBoundary",
      "iam:PutUserPermissionsBoundary",
    ]
    resources = ["*"]

    condition {
      test     = "ArnNotEquals"
      variable = "iam:PermissionsBoundary"
      values   = [local.boundary_arn]
    }
  }

  statement {
    sid    = "DenyManagingRolesWithoutBoundary"
    effect = "Deny"
    actions = [
      "iam:AttachRolePolicy",
      "iam:DeleteRolePolicy",
      "iam:DetachRolePolicy",
      "iam:PutRolePolicy",
      "iam:UpdateAssumeRolePolicy",
    ]
    resources = ["arn:${data.aws_partition.current.partition}:iam::*:role/*"]

    condition {
      test     = "ArnNotEquals"
      variable = "iam:PermissionsBoundary"
      values   = [local.boundary_arn]
    }
  }

  statement {
    sid    = "DenyAssumingOrPassingNonPolarRoles"
    effect = "Deny"
    actions = [
      "sts:AssumeRole",
      "iam:PassRole",
    ]
    not_resources = ["arn:${data.aws_partition.current.partition}:iam::*:role/polar-*"]
  }

  statement {
    sid    = "DenyRemovingPermissionBoundary"
    effect = "Deny"
    actions = [
      "iam:DeleteRolePermissionsBoundary",
      "iam:DeleteUserPermissionsBoundary",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "DenyBoundaryPolicyMutation"
    effect = "Deny"
    actions = [
      "iam:CreatePolicyVersion",
      "iam:DeletePolicy",
      "iam:DeletePolicyVersion",
      "iam:SetDefaultPolicyVersion",
    ]
    resources = [local.boundary_arn]
  }

  statement {
    sid       = "DenyOrganizationTampering"
    effect    = "Deny"
    actions   = ["organizations:*"]
    resources = ["*"]
  }

  statement {
    sid    = "DenyDisablingSecurityServices"
    effect = "Deny"
    actions = [
      "cloudtrail:DeleteTrail",
      "cloudtrail:StopLogging",
      "cloudtrail:UpdateTrail",
      "config:DeleteConfigurationRecorder",
      "config:DeleteDeliveryChannel",
      "config:StopConfigurationRecorder",
      "guardduty:DeleteDetector",
      "guardduty:DisassociateFromAdministratorAccount",
      "guardduty:DisassociateFromMasterAccount",
      "guardduty:StopMonitoringMembers",
      "securityhub:DeleteInvitations",
      "securityhub:DisableImportFindingsForProduct",
      "securityhub:DisableOrganizationAdminAccount",
      "securityhub:DisableSecurityHub",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "boundary" {
  name        = var.policy_name
  description = "Permission boundary for internal roles and users. Caps effective privileges and blocks privilege escalation via role creation."
  policy      = data.aws_iam_policy_document.boundary.json
}
