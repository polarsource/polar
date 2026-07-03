output "ipv4_ranges" {
  description = "List of Cloudflare IPv4 CIDR ranges."
  value       = local.ipv4_ranges
}

output "ipv6_ranges" {
  description = "List of Cloudflare IPv6 CIDR ranges."
  value       = local.ipv6_ranges
}

output "all_ranges" {
  description = "All Cloudflare IP ranges (IPv4 and IPv6) as a comma-separated string."
  value       = local.all_ranges
}

output "all_ranges_list" {
  description = "All Cloudflare IP ranges (IPv4 and IPv6) as a list."
  value       = concat(local.ipv4_ranges, local.ipv6_ranges)
}
