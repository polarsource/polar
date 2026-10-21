# EC2 Tailscale CA mitigation

These routers install Tailscale directly on Amazon Linux 2023, independently of
`infra/tailscale/Dockerfile`. The temporary eMudhra mitigation from
[#15709](https://github.com/polarsource/polar/pull/15709) must also reach their host
trust stores.

`mitigate-ca-trust.sh` blocks the Comodo AAA Services and emSign ECC G3 roots by
subject key ID, rebuilds the system bundles, and fails if either remains a p11-kit
trust anchor. It preserves blocklists on repeat runs or after upstream removal.
Bootstrap runs it before the first HTTPS download and again after package
installation, before starting Tailscale or retrieving its OAuth secret. On an
already-running router, the helper restarts `tailscaled` after verification so it
reloads the system roots.

## Rollout

Merging this code does not establish that existing nodes are protected. Review the
HCP Terraform plans for `sandbox`, `production`, and `test` when enabled:
`user_data_replace_on_change = true` makes this a router **replacement**, not an
in-place update. Schedule the routing interruption, keep an independent recovery
path, and validate sandbox before production. Do not apply unrelated plan changes.

If an existing router must be mitigated before replacement, transfer the reviewed
`mitigate-ca-trust.sh` through your approved administrative access path and run it
as root. Do not rerun the full bootstrap or send credentials to any test endpoint.
Run from a session that survives Tailscale restarting (or arrange recovery first).
This does not remove the later Terraform replacement.

Before considering an environment covered:

- Confirm cloud-init completed successfully, or the standalone helper exited 0.
- Check both IDs from the helper with `trust list --filter='<pkcs11 URI>'`: neither
  may show `trust: anchor`. Confirm their certificates are also absent from the
  generated TLS CA bundle at `/etc/pki/tls/certs/ca-bundle.crt`.
- Verify rejection of all 12 compromised test chains from the
  [disclosure](https://emudhra.we-have-a-problem.com/) with the host trust store;
  only a certificate-validation failure counts, not a DNS or connection failure.
- Verify credential-free HTTPS to `https://pkgs.tailscale.com/` still succeeds
  without disabling TLS verification, and check `systemctl is-active tailscaled`,
  `tailscale status`, and the advertised routes from a tailnet client.

Recheck on October 23, 2026 alongside the other mitigations in `AGENTS.md`. Removing
bootstrap code alone does not remove files on an existing host: clean up these two
blocklist files only after validating upstream protection, rebuild the bundles,
and restart `tailscaled` (or replace the router with the validated image).

## Tests

From the repository root:

```sh
uv run --no-project python -m unittest discover -s terraform/modules/ec2_tailscale/tests -v
shellcheck terraform/modules/ec2_tailscale/*.sh
```

The offline tests mock system commands and cover control flow, idempotence,
failures, ordering and cloud-init wiring. They do not establish that an AL2023 AMI
or live router rejects the compromised chains; perform the rollout checks above.
