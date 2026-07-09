# Stop subscription retries when a past-due subscription is cancelled

**Sources:** feedback#131 ("Allow merchant to stop subscription retries") · merchant support thread (Plain) · internal Slack discussions (20 May)

https://polar-sh.slack.com/archives/C0B4LFG91HP/p1779257775312979

https://polar-sh.slack.com/archives/C097MUP1F50/p1779280222852289

## Problem

When a subscription renewal payment fails, the subscription goes `past_due` and Polar enters
dunning — retrying the charge 4 more times over 21 days (`DUNNING_RETRY_INTERVALS`,
`config.py:537`). If the customer then cancels, both the merchant "cancel at period end" and the
customer-portal cancel funnel through `subscription_service.cancel`, which sets
`cancel_at_period_end` and **leaves the pending order untouched** — so dunning keeps chasing the
failed payment. Days later a retry succeeds, the customer is charged after they believed they had
cancelled, and we get refunds / chargebacks.

Today the only way to stop the retries is an immediate **revoke** (merchant/backoffice only) or a
Polar staffer manually voiding the order in backoffice (as happened repeatedly in the Plain
thread). **Customers can only cancel-at-period-end** — they have no lever to stop the retries at
all.

## The rule (agreed in Slack)

The deciding factor is the **benefit revocation grace period** — i.e. whether the customer still
had access during the past-due window:

| At cancel time | Behaviour |
| --- | --- |
| `past_due` **and grace inactive** (no grace configured, or grace expired → benefits already revoked) | **Cancel immediately + void the pending order → dunning stops.** The customer never got unpaid-for access, so nothing is owed. |
| `past_due` **and grace active** (access retained) | **Unchanged** — cancel at period end, keep collecting. The customer may have used the app unpaid, so the invoice stands. |
| not `past_due` | **Unchanged.** |

**Automatic, no toggle.** Cancelling *is* the action; the grace period decides the outcome. With
the default org setting `benefit_revocation_grace_period = 0` (`organization.py:97`), grace is
always inactive, so the common case becomes: cancel a past-due sub → retries stop immediately.

**Out of scope** (separate workstreams flagged in the discussion): the double-email comms fix
("renewed" then "failed"), and retry-cadence tuning.

## Why this mechanism

We are not building new voiding machinery — we are triggering an existing, proven path from a new
condition:

- `_perform_cancellation(immediately=True)` (`service.py:2095`) sets the sub `canceled`, and the
  resulting `became_revoked` transition (`service.py:2348`) runs `_on_subscription_revoked`
  (`service.py:2589`), which enqueues `order.void_pending_orders_for_subscription`
  (`service.py:2622`).
- `void_pending_orders_for_subscription` → `order_service.void` sets the order `void` and clears
  `next_payment_attempt_at` (`order/service.py:2642`), so `get_due_dunning_orders`
  (`order/repository.py:286`) skips it. Retries stop.
- **Precedent:** `cancel_customer` (`service.py:2009`) already does exactly this for `past_due`
  subs on customer deletion — *"Revoking them voids any pending order through
  `_on_subscription_revoked`"* (comment, `service.py:2016`). We reuse the same approach.
- Access-consistency: "grace inactive" ⟺ benefits already revoked, so cancelling *immediately*
  (access ends now) rather than at period end matches reality and the "cancel immediately"
  intent agreed in the discussion.
- In-flight payment safety: if a charge holds the payment lock, `order_service.void` raises
  `PaymentAlreadyInProgress`; the existing `void_pending_orders_for_subscription` task already
  retries on that (`order/tasks.py:268`). No new handling needed.

The grace signal itself is one existing method: `_is_within_revocation_grace_period(session,
subscription, organization)` (`service.py:2681`).

## Delivery — one PR, no migration

No schema/model changes (we reuse existing statuses, fields, and the void path). Structured as
reviewable commits.

### Commit 1 — Backend behaviour (the whole feature, server-side)

In `subscription_service.cancel` (`service.py:1890`), decide `immediately` instead of hardcoding
`False`:

- Load the subscription's organization; compute `within_grace =
  _is_within_revocation_grace_period(...)`.
- `immediately = subscription.status == SubscriptionStatus.past_due and not within_grace`.
- Delegate to `_perform_cancellation(..., immediately=immediately)`.

Extract the decision into a small helper (e.g. `_cancel_stops_collection(session, subscription)
-> bool`) so it can be reused by the API field in Commit 2 and unit-tested directly.

**Tests** (`tests/subscription/test_service.py`): past_due + no grace → immediate + pending order
voided (assert `void_pending_orders_for_subscription` enqueued, status `canceled`); past_due +
active grace → unchanged (cancel_at_period_end, order still pending); non-past_due → unchanged.
Add customer-portal coverage in `tests/customer_portal/` since that path is the primary trigger.

### Commit 2 — API signal for the warning + client regen

Both cancel UIs need to render the correct message *before* cancelling. The grace decision is
server-side (needs org grace setting + `past_due_at` + now), so expose it rather than
re-implementing on the client.

- Add a derived boolean to the subscription read schema (name TBD — e.g.
  `cancel_will_stop_collection`), computed from the Commit 1 helper. **Decision point:** field on
  the `Subscription` read schema vs. extending the existing `get_charge_preview` endpoint (already
  called in cancel flows on both portals). Recommend the derived schema field for simplicity.
- `pnpm generate` in `clients/packages/client` — regenerated client ships in this PR
  (client-sync CI).
- Endpoint test asserting the field for past_due-no-grace vs grace-active.

### Commit 3 — Merchant dashboard warning

In the merchant subscription cancel/revoke confirmation UI, when the field is set, show
"This will also stop attempting to collect the outstanding <amount> payment."

### Commit 4 — Customer-portal warning

Same message in the customer-portal cancel flow — this is the party that's actually confused
today ("I cancelled, why was I charged?").

## Resolved decisions

1. **Warning signal source** — ✅ derived boolean field on the `Subscription` read schema
   (Commit 2).
2. **Warning surface** — ✅ shown in both cancel confirmations, driven by the derived field.
   `{amount}` = outstanding order total. Strings go to
   `clients/packages/i18n/src/locales/en.ts`. Proposed starting copy (see open question on tone):
   - **Merchant** (cancel/revoke confirmation): *"This subscription has a failed payment from the
     current period. Cancelling now ends it immediately and stops retrying that payment — the
     outstanding {amount} won't be collected."*
   - **Customer portal** (cancel confirmation): *"Your latest payment didn't go through.
     Cancelling now ends your subscription immediately and stops any further payment attempts —
     you won't be charged for it."*
3. **Immediate vs. period-end for the access-revoked case** — ✅ *immediate* cancellation (matches
   the `cancel_customer` precedent).

Note: default `benefit_revocation_grace_period = 0` makes immediate-void the common path, so this
is a **behaviour change to every existing at-period-end cancel of a past-due sub** — intended per
the discussion, and called out here for explicit review.

## Open questions

- **Warning copy — tone and wording.** The strings above are a starting proposal (merchant:
  money-focused and names the amount; customer: reassurance-focused). Final tone/wording to be
  settled — including whether the customer-facing line should also name the amount.

## Explicitly out of scope

- Email/comms fix (single clear "renewal failed" email instead of "renewed" + "failed").
- Retry-cadence tuning (21-day / 9-day gaps).
- A merchant "generosity override" to stop collecting when grace *is* active (money technically
  owed). Can be a follow-up if merchants ask.
