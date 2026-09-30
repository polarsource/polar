---
'@polar-sh/cli': major
---

**API resources.** You can now manage your Polar data straight from the terminal: `polar customers`, `products`, `orders`, `subscriptions`, `checkouts`, `discounts`, `benefits`, `meters`, `webhooks` and more. They're generated from the API, so they stay in sync with it. Commands run against your selected organization (or pass `--org`), and destructive ones ask before doing anything.

**`polar trigger`.** Send fake webhook events to your app without creating anything real. `polar trigger --list` shows what's available, `--override` tweaks fields in the payload, `--seed` makes payloads reproducible, and `--json` prints the result as JSON. If `polar listen` is running, trigger shows your server's response and fails when your server doesn't accept the event.

**`polar listen`.** Pass a port (`polar listen 3000`) or a URL. It warns when nothing is running there, shows your server's actual response code for each event, and doesn't follow redirects, the same as production. Use `polar listen --print-secret` to get the signing secret straight into your `.env`.

**Auth.** `polar login` and `polar logout` are now `polar auth login` and `polar auth logout`, alongside `auth whoami`, `auth list` and `auth org` for switching organizations. The sandbox or production environment follows from the organization you pick. The org picker is skipped when you only have one.

**Everything else.** Just type `polar` to see who you're logged in as and which org is active. Windows now works natively (no WSL). You can install from npm with `npm install -g @polar-sh/cli`, and `polar update` uses whichever package manager you installed with. Output and error messages are nicer, `--help` has examples, and there's opt-out anonymous telemetry (`POLAR_CLI_TELEMETRY_OPTOUT=1`).
