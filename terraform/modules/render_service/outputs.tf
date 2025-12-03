output "api_service_url" {
  description = "The URL of the API service (used as CNAME target for custom domains)"
  value       = render_web_service.api.url
}

output "api_service_id" {
  description = "The ID of the API service"
  value       = render_web_service.api.id
}

output "worker_urls" {
  description = "Map of worker names to their URLs"
  value       = { for name, worker in render_web_service.worker : name => worker.url }
}
