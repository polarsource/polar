import {
  to = cloudflare_dns_record.mcp
  id = "22bcd1b07ec25452aab472486bc8df94/6161a4321f54135274d694198f0762be"
}

# The route sends every request to the MCP Worker, so the CNAME target is never
# reached while it is proxied. It still points at Gram until Gram is shut down.
resource "cloudflare_dns_record" "mcp" {
  zone_id = "22bcd1b07ec25452aab472486bc8df94"
  name    = "mcp.polar.sh"
  type    = "CNAME"
  content = "cname.getgram.ai"
  proxied = true
  ttl     = 1
}

resource "cloudflare_workers_route" "mcp" {
  zone_id = "22bcd1b07ec25452aab472486bc8df94"
  pattern = "mcp.polar.sh/*"
  script  = "polar-mcp"
}
