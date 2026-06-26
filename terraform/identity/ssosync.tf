locals {
  ssosync_application_id = "arn:aws:serverlessrepo:us-east-2:004480582608:applications/SSOSync"

  staff_group_emails = [
    "awsadmins@polar.sh",
    "awsengineers@polar.sh",
    "engineering@polar.sh",
    "awsaccess@polar.sh",
  ]
}

resource "aws_secretsmanager_secret" "google_credentials" {
  name = "SSOSyncGoogleCredentials"
}

resource "aws_secretsmanager_secret_version" "google_credentials" {
  secret_id     = aws_secretsmanager_secret.google_credentials.id
  secret_string = var.ssosync_google_credentials
}

resource "aws_secretsmanager_secret" "scim_access_token" {
  name = "SSOSyncSCIMAccessToken"
}

resource "aws_secretsmanager_secret_version" "scim_access_token" {
  secret_id     = aws_secretsmanager_secret.scim_access_token.id
  secret_string = var.ssosync_scim_access_token
}

resource "aws_secretsmanager_secret" "google_admin_email" {
  name = "SSOSyncGoogleAdminEmail"
}

resource "aws_secretsmanager_secret_version" "google_admin_email" {
  secret_id     = aws_secretsmanager_secret.google_admin_email.id
  secret_string = var.ssosync_google_admin_email
}

resource "aws_secretsmanager_secret" "scim_endpoint" {
  name = "SSOSyncSCIMEndpointUrl"
}

resource "aws_secretsmanager_secret_version" "scim_endpoint" {
  secret_id     = aws_secretsmanager_secret.scim_endpoint.id
  secret_string = var.ssosync_scim_endpoint
}

resource "aws_secretsmanager_secret" "google_customer_id" {
  name = "SSOSyncGoogleCustomerId"
}

resource "aws_secretsmanager_secret_version" "google_customer_id" {
  secret_id     = aws_secretsmanager_secret.google_customer_id.id
  secret_string = "my_customer"
}

resource "aws_serverlessapplicationrepository_cloudformation_stack" "ssosync" {
  name             = "ssosync"
  application_id   = local.ssosync_application_id
  semantic_version = var.ssosync_version

  capabilities = [
    "CAPABILITY_IAM",
    "CAPABILITY_NAMED_IAM",
    "CAPABILITY_AUTO_EXPAND",
    "CAPABILITY_RESOURCE_POLICY",
  ]

  parameters = {
    DeployPattern           = "App only"
    GoogleCredentials       = aws_secretsmanager_secret.google_credentials.arn
    GoogleAdminEmail        = aws_secretsmanager_secret.google_admin_email.arn
    GoogleCustomerId        = aws_secretsmanager_secret.google_customer_id.arn
    SCIMEndpointUrl         = aws_secretsmanager_secret.scim_endpoint.arn
    SCIMEndpointAccessToken = aws_secretsmanager_secret.scim_access_token.arn
    SyncMethod              = "groups"
    IncludeGroups           = join(",", local.staff_group_emails)
    LogLevel                = "info"
    LogFormat               = "json"
    ScheduleExpression      = var.ssosync_schedule_expression
  }
}
