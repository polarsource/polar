output "session_task_definition_family" {
  description = "Task definition family the orchestrator starts for each session."
  value       = aws_ecs_task_definition.session.family
}

output "session_security_group_id" {
  description = "Security group attached to session tasks."
  value       = aws_security_group.session.id
}

output "orchestrator_service_name" {
  description = "ECS service running the orchestrator."
  value       = module.orchestrator.service_name
}

output "session_log_group_name" {
  description = "CloudWatch log group for session tasks."
  value       = aws_cloudwatch_log_group.session.name
}
