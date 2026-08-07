output "service_name" {
  description = "ECS service name."
  value       = module.service.service_name
}

output "log_group_name" {
  description = "CloudWatch log group name."
  value       = module.service.log_group_name
}

output "alb_security_group_id" {
  description = "ALB security group ID, for allowing ingress to the tasks. Null when no ALB is created."
  value       = one(module.alb[*].security_group_id)
}
