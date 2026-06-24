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
  description = "Name of the IAM role for HCP Terraform runs."
  type        = string
  default     = "terraform-cloud"
}

variable "terraform_cloud_organization" {
  description = "HCP Terraform organization name."
  type        = string
}

variable "terraform_cloud_project" {
  description = "HCP Terraform project name."
  type        = string
}

variable "terraform_cloud_workspace" {
  description = "HCP Terraform workspace name."
  type        = string
}

variable "terraform_cloud_hostname" {
  description = "HCP Terraform hostname without scheme."
  type        = string
  default     = "app.terraform.io"
}

variable "audience" {
  description = "OIDC audience used by HCP Terraform dynamic AWS credentials."
  type        = string
  default     = "aws.workload.identity"
}

variable "policy_arns" {
  description = "Map of key => IAM policy ARN to attach to the role."
  type        = map(string)
}

resource "aws_iam_openid_connect_provider" "terraform_cloud" {
  url            = "https://${var.terraform_cloud_hostname}"
  client_id_list = [var.audience]
}

data "aws_iam_policy_document" "assume_role" {
  statement {
    effect = "Allow"

    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.terraform_cloud.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "${var.terraform_cloud_hostname}:aud"
      values   = [var.audience]
    }

    condition {
      test     = "StringLike"
      variable = "${var.terraform_cloud_hostname}:sub"
      values = [
        "organization:${var.terraform_cloud_organization}:project:${var.terraform_cloud_project}:workspace:${var.terraform_cloud_workspace}:run_phase:*",
      ]
    }
  }
}

resource "aws_iam_role" "terraform_cloud" {
  name               = var.role_name
  assume_role_policy = data.aws_iam_policy_document.assume_role.json
}

resource "aws_iam_role_policy_attachment" "policies" {
  for_each = var.policy_arns

  role       = aws_iam_role.terraform_cloud.name
  policy_arn = each.value
}
