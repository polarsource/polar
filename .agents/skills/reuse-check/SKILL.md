---
name: reuse-check
description: Check a diff for code that reinvents something Polar already has — a kit helper, a shared Pydantic type, a repository method, an Orbit component, an existing model property. Use before opening a PR, when reviewing a diff, or when the user asks whether a new helper, validator, type or utility already exists in the codebase.
license: MIT
metadata:
  author: polar
  version: "1.0.0"
---

# Reuse Check (Polar)

The handle is the **diff**. The evidence is **new code that duplicates something the repo
already has**, with the import that replaces it.

This is the most common substantive comment in Polar reviews: 84 of ~1,100 human review
comments from Feb to Aug 2026 point at an existing helper the author did not know about. It
is also the one category where grep beats a human reviewer, and it got worse once agents
started writing the code, because an agent that does not search first writes its own helper.

## Scope

Run on any diff that adds a function, constant, `Annotated` type, validator, enum, model
property, repository method, React component, or hook. Skip deletions, renames, config and
lockfiles.

Owned elsewhere: agent noise → `slop-check`; API contract → `api-surface-review`; deploy
safety → `ship-safety`; billing behaviour → `billing-review`.

## Method

For each new symbol:

1. **Name search** — `rg -n "def <name>|<Name>\b" server/polar clients/packages`, plus obvious
   synonyms (`normalize`/`sanitize`/`clean`, `fetch`/`get`/`load`).
2. **Behaviour search** — the distinctive part of the body: a regex literal, a library call
   (`urlparse`, `pycountry`, `stdnum`, `slugify`), a magic constant.
3. **Inventory** — check the list below.

Report only when you can name the existing symbol and its import path. A hunch is not a
finding. Always show what you searched for, so a false positive is cheap to dismiss.

## Inventory

| Home | Holds |
|---|---|
| `polar/kit/schemas.py` | `Schema`, `IDSchema`, `TimestampedSchema`, `EmptyStrToNone`, `SlugValidator`, `StripValidator`, `HttpsUrl`, `HttpUrlToStr`, `Int32`, `ClassName`, `MergeJSONSchema`, `SetSchemaReference`, `MultipleQueryFilter`, `*_ID_EXAMPLE` |
| `polar/kit/http.py` | `get_safe_return_url` (open redirect), `get_ip_address`, `add_query_parameters`, `get_content_disposition`, `is_localhost`, SSRF-safe crawling (`SSRFBlockedError`, `UnsafeCrawlableUrl`, `UrlReachability`) |
| `polar/kit/currency.py`, `money.py`, `math.py` | `get_currency_decimal_factor` (zero-decimal currencies), `get_minimum_currency_amount`, `get_maximum_currency_amount`, `format_currency`, `get_presentment_currency`, `get_cents_in_dollar_string`, `polar_round`, `non_negative_running_sum` |
| `polar/kit/pagination.py` | `ListResource`, `Pagination`, `PaginationParams`, `count_subquery` |
| `polar/kit/repository/base.py` | `get_base_statement`, `get_one_or_none`, `get_all`, `paginate`, `create`, `update`, `from_session`, `stream` |
| `polar/kit/` (rest) | `address`, `anonymization`, `crypto`, `csv`, `db`, `email` (`EmailStrDNS`), `encryption`, `html`, `json`, `jwk`, `jwt`, `locale`, `metadata`, `operator`, `routing`, `services`, `sorting`, `time_queries`, `trial`, `utils`, `visibility` |
| `server/scripts/helper.py` | `run_batched_update` |
| `polar/backoffice/forms.py` | Form builder classes. Pattern: `polar/backoffice/orders/endpoints.py` |
| `clients/packages/orbit/src/components` | `Alert`, `Avatar`, `Box`, `Button`, `ButtonGroup`, `Checkbox`, `Grid`, `GridItem`, `InlineModal`, `Input`, `List`, `ListGroup`, `Modal`, `Pill`, `SegmentedControl`, `Select`, `Spinner`, `Status`, `Subnav`, `Switch`, `Tabs`, `Text`, `TextArea`, `Tooltip`, `Truncated`, `datatable` |
| Libraries already in use | `stdnum` (tax IDs), `pycountry` (country names), `slugify`, `email_validator` |

**Also grep the model.** A lot of duplicated logic is a property that already exists:
`Organization.is_payout_ready`, `Organization.can_authenticate`, `ProductPrice.is_free`,
`Checkout.is_free_product_price`, `Payment.UNRECOVERABLE_DECLINE_CODES`.

### The ones people actually miss

- A hand-written "empty string means null" validator instead of `EmptyStrToNone`.
- A keyset loop over UUIDs instead of `RepositoryBase.stream`, which batches implicitly.
- Fetching rows only to count them, instead of an existence query.
- Hand-rolled cents conversion or currency rounding.
- A country-code table or slug regex instead of `pycountry` / `slugify`.
- A hand-built HTMX form in a new backoffice view.
- A hand-styled div that duplicates an Orbit primitive.

## Output

```
## Reuse

### 🟠 Should fix
- `file:line` — <what the new code does>. Fix: `from polar.kit.schemas import EmptyStrToNone`
  (searched: `rg "empty_str|strip_to_none" server/polar`)

### 🟡 Question
- `file:line` — <question>

### Verdict
✅ Nothing reinvented  |  ❌ n duplicates
```
