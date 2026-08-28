resource "aws_iam_organizations_features" "root_access" {
  enabled_features = [
    "RootCredentialsManagement",
    "RootSessions",
  ]

  depends_on = [aws_organizations_organization.current]
}

resource "aws_organizations_delegated_administrator" "root_access" {
  account_id        = aws_organizations_account.security.id
  service_principal = "iam.amazonaws.com"

  depends_on = [aws_iam_organizations_features.root_access]
}
