# Event ingestion service

## Deploy behind a proxy

When wiring this service into Terraform, set `FORWARDED_ALLOW_IPS` to the API's
`api_service_config.forwarded_allow_ips` value. The default trusts only `127.0.0.1`.
Without the correct setting, requests without `True-Client-IP` use the load
balancer's address and share its rate limit bucket.

The value accepts comma-separated IP addresses and CIDR networks, or exactly `*`
to trust all proxies. An empty value trusts none. Invalid entries, out-of-range
prefixes, and networks with host bits set prevent startup.
