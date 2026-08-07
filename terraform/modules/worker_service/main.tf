module "service" {
  source = "../ecs_service"

  environment              = var.environment
  name                     = var.name
  cluster_arn              = var.cluster_arn
  image                    = var.image
  command                  = var.command
  cpu                      = var.cpu
  memory                   = var.memory
  desired_count            = var.desired_count
  environment_variables    = var.environment_variables
  subnet_ids               = var.subnet_ids
  security_group_ids       = var.security_group_ids
  permissions_boundary_arn = var.permissions_boundary_arn
}
