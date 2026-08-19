---
name: billing-review
description: Review a diff that touches Polar's billing domain — subscriptions, cycles and crons, orders, billing entries, meters and usage, discounts, checkout, payments and dunning, refunds, disputes, payouts, wallets, tax and invoices. Use before opening a PR that changes money movement or subscription lifecycle, when the user asks for a billing review, or when a reviewer needs the domain rules the team enforces in review but that no linter catches.
license: MIT
metadata:
  author: polar
  version: "1.0.0"
---

# Billing Review (Polar)

The handle is the **diff**. The evidence is **where the change breaks a billing invariant the
team enforces in review**.

Not a general code review. The other lenses know Polar's conventions, contract and deploy
shape. This one knows how the billing domain is supposed to behave.

Distilled from ~210 review comments François (`frankie567`) left on billing PRs between
February and August 2026, plus domain invariants raised by `pieterbeulque`, `psincraian`,
`joebon` and `Yopi` on the same PRs. Each rule cites its PR.

**Read `.agents/skills/polar-billing.md` first.** That is the map of the domain — entities,
services, tasks, the cycle flow, proration, dunning, the ledger. This file is the checklist
that assumes it.

## Scope

```
polar/{subscription,order,billing_entry,meter,event,discount,checkout,checkout_link}/
polar/{payment,payment_method,refund,dispute,payout,payout_account,wallet,transaction}/
polar/{invoice,receipt,tax,product,customer_seat,account}/  ·  polar/benefit/grant/
polar/models/{subscription,order,order_item,product,product_price,discount,checkout,
              payment,billing_entry,refund,dispute,wallet,transaction}.py
migrations/ and server/scripts/ when they touch those tables
```

Owned elsewhere: schema and SDK impact → `api-surface-review`; migration and actor deploy
safety → `ship-safety`; `lazy="raise"` and repository conventions → `conventions-check`;
`ADR-0006` / `ADR-0007` → `adr-check`; existing helpers → `reuse-check`.

For a domain question you cannot settle from the diff, ask it rather than assert a defect.
That is how this team reviews.

## Checks

### 1. Money comes from billing entries, not derived state

`BillingEntry` is the ledger tying an invoice line back to the events that caused it. Anything
computing an amount from a summary or a recomputation loses that trace.

- Invoicing metered usage reads billing entries, never the customer meter's computed balance.
  *"Billing Entries are the source of truth… Otherwise, we lose the ability to track billing
  down to the events."* (#12510)
- If consumption happened, the entries already exist. New code that recomputes usage instead
  of picking up pending entries is a smell. (#12510)
- Order creation is what consumes pending entries. The question for a new billing trigger is
  "should this create an order", not "should this compute an amount".

### 2. Reuse the lifecycle, do not hand-roll the transition

The cycle already moves periods, writes events, and grants or revokes benefits.

- Changing plan during a trial: call `update_trial` so periods and events are right, then let
  it cycle naturally because the new period is already past — same as ending a trial
  immediately. (#11898)
- New periodic behaviour gets a scheduler modelled on `subscription/scheduler.py`, not a
  bespoke loop. (#12990)
- **One cycle, one invoice.** Overages from a meter cycle that coincides with a billing cycle
  belong on the renewal invoice, not a second order with a second payment. (#12510)

### 3. Dunning decisions live in the dunning entry point

- The retry decision belongs in `_handle_first_dunning_attempt`, not the caller. Check the
  latest payment's decline code, set a retry date if recoverable, leave it `None` otherwise.
  Everything else (past due, benefit enqueue) is untouched. (#9744)
- Never schedule a retry for a non-recoverable decline. (#9744)
- Decline-code knowledge lives on the `Payment` model as a `@property`
  (`UNRECOVERABLE_DECLINE_CODES`), guarded by `if self.processor == PaymentProcessor.stripe`
  so a second processor does not inherit Stripe's codes. (#9744)
- Retry-exhaustion arithmetic is a classic off-by-one. Check the boundary. (#11905)

### 4. Payment locks release on one path

- The webhook handler for the payment outcome (`handle_payment_failure`) releases the lock. A
  caller that also releases it on its own error path is duplicated logic — delete it and its
  test. (#10653)
- **Never release a payment lock on success.** `release_on_success` was removed from the
  codebase for this reason. A diff reintroducing it is a regression. (#10653)
- `with_for_update` belongs in the task that owns the unit of work, not inside
  `transfer_stripe`. *"This logic should be independent from Stripe behavior."* (#12097)
- A wedged lock breaks dunning silently. (#13272)

### 5. Keep processor state in sync, keep processor names out of the domain

- Domain statuses mirror the processor's vocabulary. `accepted` was rejected as a dispute
  status because Stripe uses `lost` either way, and diverging breaks the sync. (#12713)
- A merchant action with a processor counterpart makes the processor call in the same flow.
  *"The risk is way too high to forget… and let the dispute expire."* (#12713)
- Name things after the domain: "Payout Account", not "Connect". (#12097)

### 6. Crons and batch jobs

- **Catch-up loops hide missed runs.** A `while` walking forward through skipped cycles
  computes credits wrong for the periods it skipped. Prefer an invariant alert that the cycle
  did not run. (psincraian, #12510)
- Use `repository.stream` rather than a keyset loop over UUIDs. (#12749)
- Loading every row in a script or sweep is a review stop. *"Won't that blow up in memory?"*
  (#11728, #13687)

### 7. Discounts

- **Redemption counting is the whole game.** A failed payment should not count. A fully
  refunded order is an open question the team has not settled. (pieterbeulque, #13328)
- Concurrent redemption of the same code needs a customer lock, and the caller acquires it —
  say so at the call site. (joebon, #13328)
- `max_redemptions` and `max_redemptions_per_customer` are separate limits; a guard checking
  one usually needs both. (#13394)
- Expiry is checked in `cycle` but has been missed elsewhere. New paths that apply a discount
  check it too — prefer extracting the shared check. (psincraian, #12510)
- Multi-line discounts apply as a waterfall, not proportionally. Questioned in review as
  unusual for invoices; a change to allocation is a merchant-visible invoice change. (joebon,
  #12172)

### 8. Amounts, currency and tax

- Fee values are basis points: 4% is `400`. Check the unit before trusting arithmetic.
- Per-jurisdiction tax comes straight from the Numeral API response. Recomputing it from rates
  and `polar_round` introduces fractional-cent drift. (#11211)
- Tax sits on transactions of type `payment`, which are on the **Polar** side and not linked
  to the merchant's account. Transactions reach an organization through `account_id`;
  `payment_organization_id` is a Pledge-era leftover that does not mean what it looks like.
  (#12204)
- On imports, tax-inclusive versus exclusive must mirror the source provider, or the merchant
  loses money. (#12502)
- Voiding or reversing an order credits back what was applied (`applied_balance_amount`), not
  the customer's current balance. (#11637)

### 9. Free and zero-amount paths

These keep breaking because new code assumes a payment exists.

- Keep `ProductPrice.is_free` / `Checkout.is_free_product_price` checks when reworking price
  handling. (#12225)
- A new charge path supports a free price by skipping the payment step, not rejecting it.
  (#12089)
- Renewal emails, invoices and receipts all have free-subscription branches. (#9291)

### 10. Billing-specific additions to rules owned elsewhere

Short pointers only — the owning lens reports the general rule.

- **Money tables are busy tables.** `orders`, `subscriptions`, `payments`, `customers`,
  `events`. Heavy backfills go in a script; indexes go in concurrently. → `ship-safety`
- **Order foreign keys get `ondelete="restrict"`.** *"A `DELETE` statement is easy to spawn."*
  (#11206) → `ship-safety`
- **Lazy loads in money paths are stuck jobs, not just 500s.** `assert order.customer` does
  not protect you — it raises the lazy-load error itself (#11900). When a denormalized column
  lands, the matching `joinedload` usually becomes dead; remove it (#12162). →
  `conventions-check`
- **Customers cannot choose proration behaviour**, so it does not belong in the customer
  portal API. (#13095) → `api-surface-review`

## Output

```
## Billing

### 🔴 Blocking
- `file:line` — <invariant broken>. Fix: <fix>

### 🟠 Should fix
- `file:line` — <claim>. Fix: <fix>

### 🟡 Question
- `file:line` — <question>

### Notes
- domain context the author may not have: <one line, or omit>

### Verdict
✅ Clean  |  ❌ n blocking, n should-fix
```
