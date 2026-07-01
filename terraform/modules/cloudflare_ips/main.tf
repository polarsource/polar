# Cloudflare IP Ranges Module
#
# Fetches Cloudflare's published IP ranges (IPv4 and IPv6) and outputs them
# as a comma-separated string suitable for use with forwarded_allow_ips
# configuration.

# Fetch Cloudflare IPv4 ranges
# https://www.cloudflare.com/ips-v4
# Returns a plain text file with one IP range per line
data "http" "cloudflare_ips_v4" {
  url                = "https://www.cloudflare.com/ips-v4"
  request_timeout_ms = 30000
}

# Fetch Cloudflare IPv6 ranges
# https://www.cloudflare.com/ips-v6
# Returns a plain text file with one IP range per line
data "http" "cloudflare_ips_v6" {
  url                = "https://www.cloudflare.com/ips-v6"
  request_timeout_ms = 30000
}

locals {
  # Parse IPv4 ranges: split by newlines, trim whitespace, filter empty lines
  ipv4_ranges = [
    for ip in split("\n", data.http.cloudflare_ips_v4.response_body) :
    trimspace(ip) if trimspace(ip) != ""
  ]

  # Parse IPv6 ranges: split by newlines, trim whitespace, filter empty lines
  ipv6_ranges = [
    for ip in split("\n", data.http.cloudflare_ips_v6.response_body) :
    trimspace(ip) if trimspace(ip) != ""
  ]

  # Combine all ranges into a single comma-separated string
  all_ranges = join(",", concat(local.ipv4_ranges, local.ipv6_ranges))
}

# Validate that we successfully fetched at least one IP range
# If Cloudflare's endpoints return empty (transient outage), this will fail
# the Terraform plan rather than silently setting forwarded_allow_ips to ""
# which would block all traffic.
check "cloudflare_ranges_not_empty" {
  assert {
    condition     = length(local.ipv4_ranges) > 0 || length(local.ipv6_ranges) > 0
    error_message = "Cloudflare IP ranges are empty. Check if https://www.cloudflare.com/ips-v4 and https://www.cloudflare.com/ips-v6 are accessible."
  }
}
