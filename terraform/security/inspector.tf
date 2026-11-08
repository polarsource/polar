locals {
  inspector_member_accounts = {
    management = "975049931254"
    production = "538043300756"
    sandbox    = "427025827993"
    test       = "805865757777"
    identity   = "986542260309"
  }
}

module "inspector_us_east_1" {
  source = "../modules/inspector"

  member_account_ids = values(local.inspector_member_accounts)
  slack_bot_token    = var.inspector_alert_slack_bot_token
  slack_channel      = var.inspector_alert_slack_channel
}

module "inspector_us_east_2" {
  source = "../modules/inspector"
  providers = {
    aws = aws.us_east_2
  }

  member_account_ids = values(local.inspector_member_accounts)
  slack_bot_token    = var.inspector_alert_slack_bot_token
  slack_channel      = var.inspector_alert_slack_channel
}
