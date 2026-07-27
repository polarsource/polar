locals {
  permission_boundary_policy_name = "PolarPermissionBoundary"

  permission_boundary_exempt_principals = [
    "arn:aws:iam::*:role/${var.member_account_bootstrap_role_name}",
    "arn:aws:iam::*:role/${local.terraform_cloud.role_name}",
    "arn:aws:iam::*:role/aws-reserved/sso.amazonaws.com/*AWSReservedSSO_PolarAdmin*",
  ]

  permission_boundary_role_creation_exempt_principals = concat(
    local.permission_boundary_exempt_principals,
    ["arn:aws:iam::*:role/aws-service-role/sso.amazonaws.com/AWSServiceRoleForSSO"],
  )

  service_control_policies = {
    workloads_baseline = {
      name        = "WorkloadsBaseline"
      description = "Baseline guardrails for all workload accounts."
      target_ids  = [aws_organizations_organizational_unit.workloads.id]
      content = {
        Version = "2012-10-17"
        Statement = [
          {
            Sid      = "DenyRootUserActions"
            Effect   = "Deny"
            Action   = "*"
            Resource = "*"
            Condition = {
              StringLike = {
                "aws:PrincipalArn" = "arn:aws:iam::*:root"
              }
            }
          },
          {
            Sid    = "DenyLeavingOrganization"
            Effect = "Deny"
            Action = [
              "organizations:LeaveOrganization",
            ]
            Resource = "*"
          },
          {
            Sid    = "DenyDisablingAuditAndSecurityServices"
            Effect = "Deny"
            Action = [
              "cloudtrail:DeleteTrail",
              "cloudtrail:StopLogging",
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
            Resource = "*"
          },
        ]
      }
    }

    production_class = {
      name        = "ProductionClass"
      description = "Deletion and cryptographic key guardrails for production-class workload accounts."
      target_ids = [
        aws_organizations_organizational_unit.workload["production"].id,
        aws_organizations_organizational_unit.workload["sandbox"].id,
      ]
      content = {
        Version = "2012-10-17"
        Statement = [
          {
            Sid    = "DenyKmsKeyDestruction"
            Effect = "Deny"
            Action = [
              "kms:DisableKey",
              "kms:ScheduleKeyDeletion",
            ]
            Resource = "*"
          },
          {
            Sid    = "DenyStorageAndDatabaseDestruction"
            Effect = "Deny"
            Action = [
              "s3:DeleteBucket",
              "dynamodb:DeleteTable",
              "rds:DeleteDBCluster",
              "rds:DeleteDBInstance",
              "elasticache:DeleteCacheCluster",
              "elasticache:DeleteReplicationGroup",
              "secretsmanager:DeleteSecret",
            ]
            Resource = "*"
          },
        ]
      }
    }

    test = {
      name        = "TestEnvironment"
      description = "Guardrails specific to the test workload account."
      target_ids  = [aws_organizations_organizational_unit.workload["test"].id]
      content = {
        Version = "2012-10-17"
        Statement = [
          {
            Sid    = "DenyLongTermCommitments"
            Effect = "Deny"
            Action = [
              "dynamodb:PurchaseReserved*",
              "ec2:PurchaseReserved*",
              "ec2:AcceptReservedInstancesExchangeQuote",
              "elasticache:PurchaseReserved*",
              "es:PurchaseReserved*",
              "opensearch:PurchaseReserved*",
              "rds:PurchaseReserved*",
              "redshift:PurchaseReserved*",
              "savingsplans:CreateSavingsPlan",
            ]
            Resource = "*"
          },
        ]
      }
    }

    region_restriction = {
      name        = "RestrictRegions"
      description = "Deny use of AWS regions other than us-east-1 and us-east-2 in workload accounts."
      target_ids  = [aws_organizations_organizational_unit.workloads.id]
      content = {
        Version = "2012-10-17"
        Statement = [
          {
            Sid    = "DenyRegionsOutsideAllowedList"
            Effect = "Deny"
            NotAction = [
              "budgets:*",
              "ce:*",
              "cloudfront:*",
              "health:*",
              "iam:*",
              "organizations:*",
              "route53:*",
              "sts:*",
              "support:*",
            ]
            Resource = "*"
            Condition = {
              StringNotEquals = {
                "aws:RequestedRegion" = ["us-east-1", "us-east-2"]
              }
            }
          },
        ]
      }
    }

    require_permissions_boundary = {
      name        = "RequirePermissionsBoundary"
      description = "Require the Polar permission boundary on IAM roles and users created in workload accounts, and protect it from removal."
      target_ids  = [aws_organizations_organizational_unit.workloads.id]
      content = {
        Version = "2012-10-17"
        Statement = [
          {
            Sid      = "RequireBoundaryOnRoleCreation"
            Effect   = "Deny"
            Action   = "iam:CreateRole"
            Resource = "*"
            Condition = {
              ArnNotLike = {
                "iam:PermissionsBoundary" = "arn:aws:iam::*:policy/${local.permission_boundary_policy_name}"
                "aws:PrincipalArn"        = local.permission_boundary_role_creation_exempt_principals
              }
            }
          },
          {
            Sid      = "RequireBoundaryOnUserCreation"
            Effect   = "Deny"
            Action   = "iam:CreateUser"
            Resource = "*"
            Condition = {
              ArnNotLike = {
                "iam:PermissionsBoundary" = "arn:aws:iam::*:policy/${local.permission_boundary_policy_name}"
                "aws:PrincipalArn"        = local.permission_boundary_exempt_principals
              }
            }
          },
          {
            Sid    = "DenyRemovingPermissionBoundary"
            Effect = "Deny"
            Action = [
              "iam:PutRolePermissionsBoundary",
              "iam:DeleteRolePermissionsBoundary",
              "iam:PutUserPermissionsBoundary",
              "iam:DeleteUserPermissionsBoundary",
            ]
            Resource = "*"
            Condition = {
              ArnNotLike = {
                "aws:PrincipalArn" = local.permission_boundary_exempt_principals
              }
            }
          },
          {
            Sid    = "ProtectBoundaryPolicy"
            Effect = "Deny"
            Action = [
              "iam:CreatePolicyVersion",
              "iam:DeletePolicy",
              "iam:DeletePolicyVersion",
              "iam:SetDefaultPolicyVersion",
            ]
            Resource = "arn:aws:iam::*:policy/${local.permission_boundary_policy_name}"
            Condition = {
              ArnNotLike = {
                "aws:PrincipalArn" = local.permission_boundary_exempt_principals
              }
            }
          },
        ]
      }
    }
  }

  service_control_policy_attachments = merge([
    for policy_key, policy in local.service_control_policies : {
      for target_id in policy.target_ids :
      "${policy_key}-${target_id}" => {
        policy_key = policy_key
        target_id  = target_id
      }
    }
  ]...)
}

resource "aws_organizations_policy" "service_control" {
  for_each = local.service_control_policies

  name        = each.value.name
  description = each.value.description
  type        = "SERVICE_CONTROL_POLICY"
  content     = jsonencode(each.value.content)
}

resource "aws_organizations_policy_attachment" "service_control" {
  for_each = local.service_control_policy_attachments

  policy_id = aws_organizations_policy.service_control[each.value.policy_key].id
  target_id = each.value.target_id

  depends_on = [aws_organizations_organization.current]
}
