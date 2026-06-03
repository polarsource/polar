# PRD: Fixed Fee + Seat-Based Price Composition

| | |
|---|---|
| **Status** | Draft |
| **Author** | Engineering |
| **Created** | 2026-06-03 |
| **Area** | Billing / Products / Checkout |
| **Related** | Seat-based pricing (`ProductPriceSeatUnit`), graduated/volume tiers, fixed + metered composition |

---

## 1. Summary

Allow a single product to carry **both a fixed (flat) price and a seat-based price** at the same time, so the subscription is billed `fixed_fee + seat_charge`. This unlocks "base platform fee + per-seat" pricing — e.g. a flat monthly platform fee that includes a number of seats, with graduated or volume per-seat pricing above it.

This mirrors the existing **fixed + metered** composition, where a product already combines one static price with usage-based prices. We extend the model so a seat-based price can be one of the composed prices alongside a fixed price.

### Motivating example (Sonar Atlas)

> Base platform fee: **$999/mo**, includes up to 50 members
> 51–100 members: **$20**/seat · 101–200: **$17.50**/seat · 201+: **$15**/seat

For **143 members**, the correct charge is:

```
$999 (base) + 50 × $20 + 43 × $17.50 = $2,751.50
```

…not a flat `143 × $17.50 = $2,502.50`. The $999 is **additive** on top of the graduated per-seat charges for seats above the included 50.

Modeled with composition:
- **Fixed price:** `$999`
- **Seat price (graduated):** `1–50 @ $0`, `51–100 @ $20`, `101–200 @ $17.50`, `201+ @ $15`
- Total at 143 seats = `$999 + (50 × $0) + (50 × $20) + (43 × $17.50)` = **$2,751.50** ✅

---

## 2. Problem & Motivation

Today a product may hold **at most one static price** (fixed, custom, or free) plus any number of metered prices. `seat_based` is classified as a *static* price, so a product can hold **either** a fixed price **or** a seat price — never both.

Merchants increasingly want a **base platform fee combined with per-seat pricing** ("seats included in the base, then $X/seat beyond"). There is no way to express this today:

- A seat-only price cannot represent an additive flat base fee that is independent of the per-seat rate (the base $999 is not a clean multiple of any per-seat rate).
- Adding a one-off `minimum_amount` field to the seat price expresses a *floor* (`max`), not an *additive base* (`+`), and only coincides with the desired behavior when the included seats are priced at `$0`. It is a narrower, single-purpose primitive.

Composition is the more general and architecturally consistent solution: it reuses the same "sum of price contributions" model the platform already uses for fixed + metered, produces a clean separate invoice line item for the base fee, and composes naturally with discounts and proration.

---

## 3. Goals & Non-Goals

### Goals

- A product can hold **one fixed price + one seat-based price** in the same currency (recurring products).
- The subscription/checkout amount is computed as `fixed_fee + seat_charge(seats)`.
- Fully compatible with **graduated and volume** seat tiers (no change to tier math).
- Works end to end: product creation/update, checkout, subscription lifecycle (seat changes, proration), orders/invoices (separate line items), discounts, customer portal, webhooks.
- Backward compatible: existing seat-only and fixed-only products are unaffected.

### Non-Goals

- **No** `minimum_amount` / floor primitive on seat prices (explicitly the alternative we are *not* doing here). The rare "floor over a nonzero continuous per-seat rate" case is out of scope.
- **No** support for more than one fixed price or more than one seat price per currency.
- **No** seat + custom (PWYW) or seat + free composition (see Open Questions).
- **No** changes to seat assignment / claim / revoke mechanics.
- **No** seat-based pricing on one-time (non-recurring) products beyond what exists today.

---

## 4. Background: current architecture

- **Price types** (`models/product_price.py`): `fixed`, `custom`, `free`, `metered_unit`, `seat_based`. `is_static` ⊇ {fixed, custom, free, **seat_based**}; metered is dynamic.
- **Composition today:** a product holds a list of prices. Subscription amount = Σ `SubscriptionProductPrice.amount`. Each `SubscriptionProductPrice.from_price()` snapshots a price's amount (fixed → `price_amount`; seat → `calculate_amount(seats)`; metered → billed later).
- **Constraint** (`product/service.py:635–648`): "Only one static price is allowed" per currency (legacy recurring exempted). Cross-currency structure must match (`:679–697`).
- **Checkout** (`checkout/service.py`): selects a **single** default price via `PriceSet.get_default_price()` (`price_set.py:83–93`, "select the static price in priority") and derives `amount` from that one price (`:491–503`, `:716–737`). Seats → `price.calculate_amount(seats)`.
- **Orders** (`order/service.py:850–862`): collects `static_prices` as a list, but currently errors if any static price is not a fixed price.
- **Billing entries** (`billing_entry/service.py:91`, `:184`): already build a line item **per price**, so per-price processing is supported.

The key insight: **summation already exists** at the subscription/order layer; the work is (a) relaxing the validation, and (b) making **checkout** sum two static prices instead of reading one.

---

## 5. Pricing semantics

Let `F` = fixed price amount, `S(n)` = seat charge for `n` seats (volume or graduated, per existing `calculate_amount`).

```
total(n) = F + S(n)
```

The fixed fee is **always** added, independent of seat count, on every billing period. It is **not** a floor: it does not absorb per-seat charges.

To express "first K seats included in the base," the merchant prices the first tier at `$0/seat` (e.g. `1–50 @ $0`), so those seats contribute nothing and `F` covers them. Per-seat charges begin at the first non-zero tier.

### Worked examples

**A. Base fee + graduated (Sonar):** `F = $999`; seat graduated `1–50 @ $0, 51–100 @ $20, 101–200 @ $17.50, 201+ @ $15`

| Seats | Fixed | Seat charge | Total |
|------:|------:|------------:|------:|
| 30 | $999 | $0 | **$999** |
| 50 | $999 | $0 | **$999** |
| 80 | $999 | 30 × $20 = $600 | **$1,599** |
| 143 | $999 | $1,000 + $752.50 = $1,752.50 | **$2,751.50** |

**B. "Minimum-style" base + flat per-seat:** `F = $200`; seat `1–10 @ $0, 11+ @ $20` (volume or graduated identical here)

| Seats | Fixed | Seat charge | Total |
|------:|------:|------------:|------:|
| 5 | $200 | $0 | **$200** |
| 10 | $200 | $0 | **$200** |
| 15 | $200 | 5 × $20 = $100 | **$300** |

**C. Base fee + volume:** `F = $500`; seat volume `1–10 @ $20, 11+ @ $15`

| Seats | Fixed | Seat charge (all seats at matched tier) | Total |
|------:|------:|-----------------------------------------:|------:|
| 8 | $500 | 8 × $20 = $160 | **$660** |
| 20 | $500 | 20 × $15 = $300 | **$800** |

---

## 6. Functional requirements

**FR-1 — Allowed combination.** A recurring product may contain, per currency, exactly: 0–1 fixed price **and** 0–1 seat-based price, plus any number of metered prices. The fixed + seat combination is newly permitted.

**FR-2 — Disallowed combinations.** Still rejected: >1 fixed, >1 seat, seat + custom, seat + free, multiple static prices of the same kind. (Custom/free + seat are excluded for now; see Open Questions.)

**FR-3 — Amount computation.** Anywhere a subscription/checkout/order amount is derived, the static contribution is `F + S(n)` (sum of fixed `price_amount` and seat `calculate_amount(seats)`), plus metered usage billed in arrears as today.

**FR-4 — Checkout.** Checkout for a fixed + seat product must charge `F + S(seats)` upfront. Seat selection (`seats`) drives `S(n)`; the fixed fee is added unconditionally. Minimum/maximum seat constraints from the seat price still apply.

**FR-5 — Subscription lifecycle.** On seat changes, only the **seat** contribution is re-prorated (`Δ = S(new) − S(old)`); the fixed fee is unchanged and not re-charged mid-period. Cancellation/renewal behave as today, summing both static contributions per period.

**FR-6 — Orders & invoices.** The order shows the fixed fee and the seat charge as **separate line items** (matching the existing per-price line item model). Metered usage remains its own line item(s).

**FR-7 — Discounts.** A discount applies to the subscription total, i.e. to `F + S(n)` (percentage discounts cover the base fee too). Behavior must match how discounts already aggregate across composed prices.

**FR-8 — Backward compatibility.** Existing seat-only and fixed-only products, and all existing fixed + metered products, are unchanged. No data migration of existing prices.

**FR-9 — API & schema.** Product create/update accepts a `prices` list containing both a fixed price and a seat price. `ProductPriceCreateList` description and validation updated. Product read schema returns both prices (already a list).

**FR-10 — Frontend.** Merchant product editor supports configuring a fixed fee alongside seat tiers. Checkout and customer portal display the base fee and per-seat charge clearly (the Sonar card is a reference layout).

---

## 7. Technical design

No new model or column is required. `seat_based` already exists and is `is_static`; subscriptions/orders already sum `SubscriptionProductPrice`/line items. The work is concentrated in **validation**, **checkout amount computation**, and **frontend**.

### 7.1 Product validation — `product/service.py` (`_validate_prices`, ~`:635–697`)

- Replace the blanket "Only one static price is allowed" rule with a structured rule:
  - At most **one fixed** price per currency.
  - At most **one seat** price per currency.
  - Reject seat + custom and seat + free combinations (for now).
- Update the **price-structure signature** used for cross-currency consistency (`:679–683`) from `(static_count, metered_count)` to distinguish kinds, e.g. `(has_fixed, has_seat, metered_count)`, so all currencies must define the same composition.
- Keep tax-behavior-consistency and meter-uniqueness checks unchanged.

### 7.2 Price list schema — `product/schemas.py`

- Update `ProductPriceCreateList` / `prices` field descriptions (`:390–403`, `:413–419`) to document the allowed combinations (≤1 fixed, ≤1 seat, N metered).
- No new price schema types; reuse `ProductPriceFixedCreate` + `ProductPriceSeatBasedCreate`.

### 7.3 Checkout — `checkout/service.py` (primary engineering work)

Today checkout picks **one** default price and reads its amount (`:366–367`, `:491–503`, `:700–737`). For fixed + seat it must combine **two upfront static prices**:

- Compute the upfront `amount` as the **sum over all static prices** in the selected currency: `Σ price.price_amount` (fixed) `+ price.calculate_amount(seats)` (seat). Metered prices contribute `0` upfront (unchanged).
- `PriceSet.get_default_price()` (`price_set.py:83–93`) currently returns a single static price; introduce a helper to enumerate the upfront-billable static prices (fixed + seat) rather than assuming one. Audit all callers of `get_default_price` (checkout create `:367`, prefill `:713`).
- Seat min/max validation and the `seats` input flow are unchanged; only the amount aggregation changes.
- Confirm `Checkout.amount` / `total_amount` / `tax_amount` are computed from the summed static amount. If `Checkout` stores a single `amount`, ensure it holds the combined figure (and that line-item breakdown is reconstructable from the product's prices at confirmation).

### 7.4 Subscription — `models/subscription.py`, `subscription/update.py`

- `update_amount_and_currency` already sums `SubscriptionProductPrice` rows → `F + S(n)` works once both prices are attached.
- Seat-change proration (`subscription/update.py:_generate_seats_subscription_update`, `:207–208`) operates only on the seat price via `calculate_amount`; the fixed fee is untouched. No change expected — **add tests** to lock this in.
- Ensure both static prices are attached as `SubscriptionProductPrice` on subscription creation from a fixed + seat checkout.

### 7.5 Orders & invoices — `order/service.py` (`~:850–862`)

- The static-price line-item builder currently errors if a static price is not fixed. Extend it to also handle a seat price (build its line item via the seat amount), producing **two static line items** (base fee + seats) when both are present.
- Verify the recurring order path emits both line items each period.

### 7.6 Billing entries — `billing_entry/service.py`

- Per-price line items already supported (`:91`, `:184`). Verify the seat and fixed entries coexist and aggregate correctly into an order; likely no change beyond tests.

### 7.7 Integrations & read models

- Audit places that assume a single static/fixed price: `product/repository.py` (`price_amount` projection `:136`), `integrations/polar/*` (`:93`, `:742`), `order_item.py` (`:71`), `subscription_product_price.py` (`:52`). Ensure they tolerate two static prices (iterate rather than pick first).

### 7.8 Frontend — `clients/`

- **Product editor:** allow adding a fixed price *and* a seat price together; today the UI likely enforces one static price client-side. Add UI to set the base fee alongside seat tiers.
- **Checkout:** display base fee + per-seat breakdown and the combined total; seat selector drives the per-seat portion.
- **Customer portal / subscription view:** show both contributions.
- Regenerate API client/types if schema descriptions or validation surfaces change.

### 7.9 Data & migration

- No DB migration. No backfill. Existing products unaffected (FR-8).

---

## 8. Edge cases

- **Currency parity:** every currency for the product must define the same composition (both fixed + seat, or neither). Enforced by the structure-signature check (7.1).
- **`$0` first tier vs free price:** included seats are modeled as a `$0/seat` first tier on the **seat** price, not as a separate `free` price. Seat + free remains disallowed.
- **Seat minimum interaction:** `get_minimum_seats()` (seat price first tier `min_seats`) still gates the minimum purchasable seats, independent of the fixed fee. "Pay $999 and buy ≥ N seats" remains expressible.
- **Proration of base fee:** the fixed fee is not re-prorated on seat changes (FR-5); only `ΔS` is prorated. Plan switches that change the fixed price follow existing fixed-price proration rules.
- **Discount scope:** percentage discount reduces `F + S(n)`; fixed-amount discount applies once to the total, not per price (must match existing aggregate-discount behavior).
- **Tax behavior:** both prices must share tax behavior per currency (existing rule retained).
- **One-time products:** seat-based one-time behavior is unchanged; fixed + seat on one-time is in/out per existing seat one-time support — default to **recurring only** unless a need is identified.

---

## 9. Testing strategy

- **Unit (model):** subscription amount = `F + S(n)` for volume and graduated; Sonar 143-seat case = $2,751.50; example B = $200/$200/$300.
- **Validation:** fixed + seat accepted; >1 fixed, >1 seat, seat + custom, seat + free rejected; cross-currency structure mismatch rejected.
- **Checkout:** upfront amount = `F + S(seats)`; seat min/max enforced; multi-currency; tax computed on combined amount.
- **Subscription lifecycle:** create attaches both prices; seat increase/decrease prorates only the seat delta; renewal charges `F + S(n)` each period.
- **Orders:** two static line items (base fee + seats) + metered line items; amounts reconcile to subscription total.
- **Discounts:** percentage and fixed discounts over the combined total.
- **Regression:** existing seat-only, fixed-only, fixed + metered products unchanged.
- **Frontend:** editor can configure both prices; checkout/portal render the breakdown.

---

## 10. Rollout

1. Backend: validation relaxation + checkout aggregation + order line items, behind tests. API accepts the combination.
2. Frontend: product editor + checkout/portal display.
3. Docs: update pricing docs / API guidelines with the composition example.
4. No feature flag strictly required (additive capability), but consider gating the editor UI until checkout + orders are verified end to end in sandbox.

---

## 11. Open questions

1. **Seat + custom (PWYW) and seat + free:** keep disallowed, or allow in a later iteration? (Default: disallowed now.)
2. **Checkout amount storage:** does `Checkout.amount` need to become a per-price breakdown, or is a combined integer plus recompute-at-confirmation sufficient? (Affects 7.3.)
3. **One-time products:** support fixed + seat for one-time purchases, or recurring only? (Default: recurring only.)
4. **Naming/UX:** how is the fixed fee surfaced to buyers ("Base platform fee" label) and configured by merchants?
5. **Legacy recurring products:** confirm the legacy exemption path (`:639–640`) is unaffected.

---

## 12. Appendix — file-level change checklist

| File | Change |
|---|---|
| `server/polar/product/service.py` | Replace "one static price" rule with ≤1 fixed + ≤1 seat; update cross-currency structure signature. |
| `server/polar/product/schemas.py` | Update `ProductPriceCreateList` / `prices` descriptions; document allowed combos. |
| `server/polar/product/price_set.py` | Add helper to enumerate upfront static prices (fixed + seat) vs single `get_default_price`. |
| `server/polar/checkout/service.py` | Sum static prices for upfront `amount`; audit `get_default_price` callers; seat flow unchanged. |
| `server/polar/order/service.py` | Build line items for fixed **and** seat static prices (remove fixed-only assumption ~`:862`). |
| `server/polar/subscription/update.py` | Verify seat-delta proration ignores fixed fee; add tests. |
| `server/polar/billing_entry/service.py` | Verify per-price entries coexist; add tests. |
| `server/polar/integrations/polar/*`, `product/repository.py`, `models/order_item.py`, `models/subscription_product_price.py` | Audit single-static-price assumptions; iterate over static prices. |
| `clients/` (product editor, checkout, customer portal) | Configure + display fixed fee alongside seat tiers; regenerate types. |
| `server/tests/**` | Validation, checkout, subscription, order, discount, regression tests. |

---

## 13. Decision context (why composition over a seat `minimum_amount`)

`minimum_amount` is `max(min, seat_charge)` (a floor); composition is `fixed + seat_charge` (additive). They coincide only when included seats are `$0/seat`, which is exactly how the base-fee use cases are modeled. Composition is chosen because it:

- reuses the existing "sum of composed prices" model (consistent with fixed + metered),
- yields a clean, separate invoice line item for the base fee,
- composes naturally with discounts and proration,
- avoids introducing a single-purpose pricing primitive.

Trade-off: composition cannot express a floor over a *nonzero, continuous* per-seat rate whose crossover falls between integer seat counts (e.g. "$250 min, $20/seat" crossing at 12.5 seats). This case is judged rare and is out of scope; if it becomes a real requirement, a seat `minimum_amount` can be added later as a complementary primitive.
