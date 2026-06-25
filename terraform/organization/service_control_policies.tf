locals {
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
