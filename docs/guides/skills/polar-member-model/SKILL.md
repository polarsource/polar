---
name: polar-member-model
description: Migrate a Polar seat-based integration from customer_id to the member model. Use when Polar has told you your organization moves to the member model, or when code reads customer_id to identify who holds a seat.
---

# Migrate a Polar seat-based integration to the member model

On seat-based products, `customer_id` used to be the seat holder. It becomes the
buyer. Every seat and grant carries a `member`, which is the person. Read that.

## Change

Find reads of `customer_id` on seats and benefit grants — REST responses and the
`customer_seat.*`, `benefit_grant.*` webhooks — and rewrite the ones that mean
"the person holding this seat":

```diff
- grantAccess(seat.customer_id)
+ grantAccess(seat.member.id, seat.member.email)
```

Leave the ones that mean "the account that pays". `seat.email` and
`seat.customer_email` already resolve to the holder; leave those too.

## Watch out

A branch on whether `member` is set cannot tell a seat holder from a buyer:
direct purchases carry the buyer's own member.

```diff
- if (grant.member) { holder(grant.member) } else { buyer(grant.customer_id) }
+ holder(grant.member)
```

Keep a null check for the type, but read no meaning into it — Polar leaves
`member` unset on old revoked grants. Use `member.role` to tell a buyer (`owner`,
`billing_manager`) from a holder (`member`), and `member.customer_id` for the
billing customer.

## Also

- Seat-holder `customer_id` stored in your database will return `404`. Remap it
  to `member.id` from `GET /v1/customer-seats`, or set `external_member_id` at
  assignment and key on your own identifier.
- Pass `member_id` to `customerSessions.create`. Required for team customers.
- Never mix `customer_id`/`external_customer_id` with
  `member_id`/`external_member_id` in one seat assignment.

## Report

List every read you left alone as "the buyer", so a human can check the call.
