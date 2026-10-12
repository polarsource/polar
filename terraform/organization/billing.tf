module "grafana_cloudwatch_role" {
  source = "../modules/grafana_cloudwatch_role"

  name                     = "polar-management-grafana-cloudwatch"
  external_id              = var.grafana_cloud_aws_external_id
  permissions_boundary_arn = module.permission_boundary_management.policy_arn
  tags = {
    environment = "management"
  }
}
