# Local E2E tests

Playwright end-to-end tests that run against this worktree's **dev-docker** stack (frontend +
backend + DB), authored and healed with the help of AI.

## Run

```bash
dev e2e                          # bootstraps (deps, browser, stack, seed) then runs all specs
dev e2e signup                   # filter by name/path
dev e2e --headed --workers=2     # pass args through to Playwright
dev e2e --screenshots            # capture a screenshot + video for every test
dev e2e --report                 # open the HTML report when done
```

`dev e2e` auto-detects the instance (via `dev docker`), computes the web/api ports, waits for
readiness, and exports `E2E_WEB_URL` / `E2E_API_URL` / `E2E_INSTANCE`.

## The tests

| Spec | What it proves |
|------|----------------|
| `signup.spec.ts` | Full sign up: a brand-new email → email OTP → business onboarding (personal → business → product) → lands on the new org's dashboard. Runs **unauthenticated** (overrides the shared storageState). |
| `create-product.spec.ts` | Authenticated as the seed admin, creates a product from the dashboard and confirms it appears in the catalogue. |

## Layout

| Path | What |
|------|------|
| `global-setup.ts` | Waits for the stack, logs in once as the seed admin via the real OTP flow, saves `storageState` so authenticated specs start logged in (and stay parallel). |
| `fixtures.ts` | Extended `test` with `adminOrgSlug`. Import `{ test, expect }` from here. |
| `support/env.ts` | Resolves URLs + instance from env (dev-docker aware). |
| `support/auth.ts` | Admin login helper; reads the OTP from the api container logs (stderr). |
| `support/signup.ts` | Fresh registration + the onboarding wizard walk-through. |

## Authoring & healing with AI

This suite is grown and repaired as **phase 2 of `/verify`** (the `verifier-web` skill) — there is no
separate command. After `/verify` confirms a change works, and only if the change is a new feature or
a bug fix worth a lasting guard, it adds one **minimal** spec (deduped against what already exists),
then runs the whole suite as a regression check. Keep the suite small and high-value.

Specs are authored by hand following the conventions below — drive the flow once in the live UI to
get stable selectors, then write the spec. On selector drift, reproduce in the live UI and repair the
spec (scope edits to `e2e/`).

## Note: onboarding AUP route

The signup flow calls `/onboarding/validate-description`, which reads a generated
`acceptable-use-policy.mdx` (produced by `pnpm copy-aup`, run in `prebuild` and traced into the prod
bundle). The route reads it lazily and degrades to empty on a missing file, so it never 500s locally
— with no gateway key configured it returns `APPROVE` regardless, so the signup flow just works.

## Conventions

- Prefer role-based locators (`getByRole`, `getByLabel`, `getByPlaceholder`).
- Assert real content, not loose text (e.g. match a product row by its href, not the name, which can
  collide with nav like "Products").
- Keep every spec/helper under the 250-line frontend limit; factor shared code into `support/`.
