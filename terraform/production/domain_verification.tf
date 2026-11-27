resource "cloudflare_dns_record" "polar_domain_verification" {
  zone_id = "22bcd1b07ec25452aab472486bc8df94"
  name    = "_polar-challenge.polar.sh"
  type    = "TXT"
  content = "bIZhaDdWN8vkt22hDQPeyrutJ4gFb8fHqohtk4W5dqk"
  ttl     = 1
}

resource "cloudflare_dns_record" "openai_business_profile" {
  zone_id = "22bcd1b07ec25452aab472486bc8df94"
  name    = "openai-business-profile.polar.sh"
  type    = "TXT"
  content = "openai-business-profile=aDgykBrIABCpL666vvvka4YzIBOkq2-11Qfgk77zyyI"
  ttl     = 1
}
