output "service_name" {
  description = "ECS service name."
  value       = module.service.service_name
}

output "log_group_name" {
  description = "CloudWatch log group name."
  value       = module.service.log_group_name
}
