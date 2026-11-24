---
name: local-login
description: Sign in to the locally running Polar dashboard with the `dev otp` command. Use whenever a task needs a logged-in local session, such as checking a dashboard change in the browser, taking screenshots, reproducing a bug behind login, or when a local page stops at /auth/email-otp and asks for a 6-character code.
license: MIT
metadata:
  author: polar
  version: "1.0.0"
---

# Local login

Local sign-in uses the real email code flow. The code is never emailed anywhere
you can read, and the API only stores a hash of it. `dev otp` gives you a code
that works.

## Steps

1. Open `http://127.0.0.1:3000/auth`. `/login` returns 404.
2. Enter the email and click **Sign in with email**. `admin@polar.sh` is the
   seeded test account. An email with no account signs up a new local user.
3. Wait for the page to reach `/auth/email-otp`.
4. Run `dev otp` and read the code from its output:

   ```
     RG9EJD  admin@polar.sh
     Requested 1 minute ago, expires in 29 minutes
   ```

5. Type the code into the page. It submits by itself after the sixth character
   and lands on the dashboard.

## What to know

- **Order matters.** `dev otp` needs a sign-in that is waiting for a code. If it
  prints "No sign-in is waiting for a code", do steps 1 to 3 first.
- **It issues a new code.** The code in the API log (`LOGIN CODE: …`) stops
  working once `dev otp` has run. Each run also replaces the code from the
  previous run, so always use the last one printed.
- **Several sign-ins waiting.** It picks the most recent one. Run
  `dev otp <email>` to pick by address, for example when a person and an agent
  are signing in at the same time.
- **Codes last 30 minutes** from the moment the email was entered. After that,
  start again from step 1.
- **Development only.** It refuses to run outside development or against a
  database that is not local.

## From a script

`dev otp` prints for people. A script can call what it wraps, from `server/`:

```bash
uv run python -m scripts.dev_login_code --email admin@polar.sh
```

It prints `EMAIL=`, `CODE=`, `CREATED_AT=` and `EXPIRES_AT=` lines (the last two
as Unix timestamps), or nothing when no sign-in is waiting.

## Docker stack

`dev otp` uses the database in `server/.env`, which is the stack started by
`dev up`. For the `dev docker` stack, read the code from the api container's
logs instead, as described in the `local-environment` skill's
[payment-testing rule](../local-environment/rules/payment-testing.md).
