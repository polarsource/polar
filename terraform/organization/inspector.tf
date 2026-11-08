resource "aws_inspector2_delegated_admin_account" "us_east_1" {
  account_id = aws_organizations_account.security.id
}

resource "aws_inspector2_delegated_admin_account" "us_east_2" {
  provider = aws.us_east_2

  account_id = aws_organizations_account.security.id
}
