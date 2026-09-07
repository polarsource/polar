# Private backoffice

The private backoffice runs the normal backend image as a Render background worker.
It mounts only the backoffice and its login routes. Uvicorn listens on
`127.0.0.1:10000`; Tailscale Serve provides HTTPS on the node's `*.ts.net` name.
The worker has no public HTTP endpoint.

Public access stays enabled by default. The private and public processes share the
database, Redis, and signing configuration.

## Authentication and impersonation

1. An authorized tailnet user opens the private URL.
2. The backoffice redirects to Polar's existing OAuth consent/login page on the
   normal dashboard domain, using authorization code flow with PKCE (S256).
3. The browser returns to the private callback. The backoffice exchanges the code
   with the public API and sets a host-only, Secure, HttpOnly cookie.
4. Every backoffice request checks the OAuth token's client, expiry, revocation,
   scopes, current admin status, and the matching `Tailscale-User-Login` email.
   The Tailscale identity is an additional requirement, never a substitute for
   Polar authorization.
5. Impersonation creates a single-use, 60-second Redis grant. The browser redeems
   it on the public API, which verifies the same logged-in admin and a still-valid
   backoffice authorization before setting the existing Polar impersonation
   cookies. The resulting session retains the existing read-only, organization
   scope and one-hour lifetime.
6. “Exit impersonation” restores the original admin cookie on the public API and
   returns to the private backoffice. The private OAuth session stays independent
   of the impersonated dashboard session.

Only opaque codes appear in redirect URLs. Login reuses Polar's OAuth state service
and state-cookie helper. State is browser-bound and expires after ten minutes;
the PKCE verifier stays in the database and the access token in a HttpOnly cookie.
Impersonation grants are stored hashed and consumed atomically. Private responses
and public handoff responses disable caching and referrers.

The private session follows the normal OAuth token lifetime. Sign out revokes that
token. Revoking OAuth access or removing admin status also blocks subsequent access.
Signing out of the dashboard does not revoke the separate OAuth session. If private
login expires during impersonation, exit impersonation before signing in again.
Expired private sessions redirect to login, including during HTMX requests. Login
returns to the requested page and query; interrupted writes return to the backoffice
root without replaying the action.

Both impersonation entry points use the same session service and cookie helpers.
Switching targets preserves the original admin cookie and revokes the previous
impersonation session.

## Provisioning

1. Enable MagicDNS and HTTPS certificates in the tailnet. Choose an unused node name,
   for example `backoffice`, and obtain the tailnet DNS suffix from Tailscale's DNS
   settings. The resulting origin is `https://backoffice.<tailnet>.ts.net`.
   The launcher verifies the actual assigned name and refuses to serve if it differs.
2. Give a dedicated `tag:backoffice` node an ACL/grant allowing the backoffice admin
   group to reach TCP 443. Use a reusable, preauthorized, non-ephemeral auth key with
   that tag. Store it in Terraform Cloud, separately from subnet-router keys.
   Users must connect from user-owned devices: tagged clients have no user identity.
   Keep Funnel disabled for this node.
3. Register a public OAuth client with the existing `POST /v1/oauth2/register`
   endpoint on the environment's regular API. Use this JSON, replacing the hostname:

   ```json
   {
     "client_name": "Polar Backoffice",
     "redirect_uris": ["https://backoffice.<tailnet>.ts.net/auth/callback"],
     "token_endpoint_auth_method": "none",
     "grant_types": ["authorization_code"],
     "response_types": ["code"],
     "scope": "openid email",
     "default_sub_type": "user"
   }
   ```

   Keep the returned registration token in the team's secret store for future
   client management. The application needs only `client_id`; it uses PKCE and
   does not require a client secret or a separate OAuth provider registration.
4. Deploy the backend image containing this change and the dashboard return-link
   change before creating the worker.
5. Apply the global Terraform variable declarations. In the target environment's
   Terraform Cloud variable set, set the sensitive HCL `private_backoffice` value:

   ```hcl
   {
     url             = "https://backoffice.<tailnet>.ts.net"
     oauth_client_id = "<registered client_id>"
     auth_key        = "<dedicated Tailscale auth key>"
   }
   ```

   It defaults to `null`, so other environments remain unchanged. Optional `tags`
   and `plan` default to `tag:backoffice` and `standard`.
6. Apply the environment's Terraform. This creates the worker and persistent state
   disk, attaches the existing backend environment groups, and configures the
   public API handoff. Leave `public_backoffice_enabled = true`.
7. Set the Terraform `backoffice_service_id` output as the GitHub environment
   variable `RENDER_BACKOFFICE_SERVICE_ID`. Subsequent backend deploys update this
   worker alongside the other workers, using the existing migration ordering.

The disk preserves node identity and certificates across deployments. It also means
one worker instance and a brief interruption during deploys. Monitor worker restarts
and Tailscale node expiry; rotating an enrollment key does not rotate existing node
identity.

## Verification and public cutover

Before cutover, verify on a user-owned Tailscale device:

- HTTPS uses a valid Tailscale-managed certificate; login returns to the private URL.
- An admin can browse pages, load static assets, and submit an ordinary backoffice form.
- A mismatched Polar/Tailscale user is denied.
- Impersonation opens the regular dashboard, remains read-only, and exits back to the
  private organization page with the original admin restored.
- The private URL is unreachable off-tailnet and the worker has no public web port.
- Restarting the worker preserves its exact DNS name and HTTPS availability.

Then set `public_backoffice_enabled = false` in the environment's Terraform Cloud
variable set and apply. Public API processes no longer mount the backoffice,
including on the old hostname and `/backoffice` path. Worker-generated backoffice
links use the private URL. DNS removal is optional; route removal enforces cutover.

The regular OAuth endpoints and the narrow
`/v1/backoffice/impersonation/{start,end}` cookie bridge remain public. Starting
impersonation requires a fresh private grant and a matching public admin session;
the bridge cannot create grants or serve backoffice pages. Ending impersonation
must remain reachable on the domain that owns the dashboard cookies.

Repeat the impersonation check after cutover. To roll back public accessibility,
set `public_backoffice_enabled = true` and apply.

## Local regression checks

From `server/`, with the normal local test dependencies available:

```sh
uv run pytest tests/backoffice/test_private.py tests/backoffice/impersonation tests/oauth2/endpoints/test_oauth2.py
```

These tests exercise real database sessions, OAuth client requests, private route
isolation, identity checks, and both halves of impersonation after public cutover.
The callback test substitutes the external token HTTP response; existing OAuth
endpoint tests separately exercise the real authorization-code/PKCE exchange.
They do not provision a live tailnet or validate a deployed certificate.

References: [Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve),
[HTTPS certificates](https://tailscale.com/docs/how-to/set-up-https-certificates),
[Render background workers](https://render.com/docs/background-workers).
