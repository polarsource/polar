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

  lifecycle {
    postcondition {
      condition     = self.response_body != "" && self.status_code == 200
      error_message = "Cloudflare IPv4 ranges endpoint failed. Check https://www.cloudflare.com/ips-v4"
    }
  }
}

# Fetch Cloudflare IPv6 ranges
# https://www.cloudflare.com/ips-v6
# Returns a plain text file with one IP range per line
data "http" "cloudflare_ips_v6" {
  url                = "https://www.cloudflare.com/ips-v6"
  request_timeout_ms = 30000

  lifecycle {
    postcondition {
      condition     = self.response_body != "" && self.status_code == 200
      error_message = "Cloudflare IPv6 ranges endpoint failed. Check https://www.cloudflare.com/ips-v6"
    }
  }
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
