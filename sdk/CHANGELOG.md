# Changelog

All notable changes to the Polar SDKs will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Entries apply to all SDKs unless prefixed with a language name, such as `Python:` or `TypeScript:`.
History up to [1.0.0-alpha.22] is available in the existing GitHub releases.

## [Unreleased]

## [1.4.0] - 2026-11-27

### Added

- 2027-01: customer state (`customers.getState`, `customers.getStateExternal` and the `customer.state_changed` webhook) includes the external ID next to each Polar ID: `external_product_id` on `active_subscriptions`, `external_benefit_id` on `granted_benefits` and `external_meter_id` on `active_meters`. Each is `null` when the product, benefit or meter has no external ID.
- 2027-01: `orders.create` references the customer by `customer_id` or `external_customer_id`, and the product by `product_id` or `external_product_id`. It also accepts `currency`, `amount`, `units` and `description`, and throws `OffSessionChargesNotEnabled` (403).
- 2027-01: `subscriptions.create` accepts `external_customer_id` together with `external_product_id`.
- 2027-01: `checkouts.update` accepts `external_product_id` to switch the checkout's product by external ID.

### Changed

- 2027-01: `currency` on `subscriptions.create` is no longer nullable. Leave it out instead of sending `null`.

### Removed

- 2027-01: `external_id` on discounts, in the create, update and read schemas and the `discounts.list` filter.
- 2027-01: `webhooks.getExternalWebhookEndpoint` and its `AmbiguousExternalWebhookEndpointID` error.
- 2027-01: the `staged_events_ingest_enabled` and `lemon_squeezy_migration_enabled` organization feature settings.

## [1.3.3] - 2026-11-23

### Fixed

- TypeScript: Fix browser bundler errors (esbuild `--platform=browser`, Convex) caused by buffered metering importing `node:timers/promises`.

## [1.3.2] - 2026-11-20

- Regenerate 2027-01 version. Update schemas won't accept `null` values if the schema type is not nullable.

## [1.3.1] - 2026-11-18

### Fixed

- Fix outpost related bundler errors

## [1.3.0] - 2026-11-16

### Changed

- Python: use HTTPX2 for HTTP transport and its default TLS verification for SDK-created clients. Custom timeouts support both HTTPX and HTTPX2. Pass an `httpx2.AsyncClient` when supplying a client to Outpost or Vercel warmup.

## [1.2.0] - 2026-11-13

- Regenerate 2027-01 version.
- Python: don't break deserialization on unknown enum values.

## [1.1.0] - 2026-11-09

### Added

- Send a `User-Agent` header with the SDK language and version, such as `polar-sdk-python/1.0.3` or `polar-sdk-typescript/1.0.3`.

### Changed

- Rename the metering helper, actor, and strategy event method from `ingest()` to `track()` in both SDKs. The HTTP API remains `polar.events.ingest()`.

### Fixed

- Return `undefined` (`None` in Python) instead of throwing on empty-body success responses, such as the `202` returned by order receipt endpoints while the receipt is being generated.
- TypeScript: export `ClientBase` from each API version entry point, so wrapping `createPolarCore()` in an exported function compiles when emitting declarations.

## [1.0.2] - 2026-10-02

### Changed

- 2027-01 (preview): breaking change to seat-based prices, which now use the shared `tiers` contract instead of `seat_tiers` and `price_per_seat`. Seat quantity bounds use `minimum_units` and `maximum_units` instead of `minimum_seats` and `maximum_seats`.

### Fixed

- TypeScript: expose the HTTP `statusCode` on `PolarServerError` so server errors can be distinguished from network failures.

## [1.0.1] - 2026-09-30

### Added

- Add an `organizationId` option (`organization_id` in Python) to send the `Polar-Organization` header, so a client acts on a single organization when used with a user access token.
- 2027-01: license keys include `subscription_id`, `subscription`, `order_id` and `order`.

### Fixed

- 2026-10: `member_id` and `member` on license keys are typed as always present (`null` when unset), matching what the API returns.

## [1.0.0] - 2026-09-28

### Changed

- Regenerate 2026-04 and 2026-10. They are now frozen.

### Added

- Generate next 2027-01 version.

[Unreleased]: https://github.com/polarsource/polar/compare/sdk%2F1.4.0...HEAD
[1.4.0]: https://github.com/polarsource/polar/compare/sdk%2F1.3.3...sdk%2F1.4.0
[1.3.3]: https://github.com/polarsource/polar/compare/sdk%2F1.3.2...sdk%2F1.3.3
[1.3.2]: https://github.com/polarsource/polar/compare/sdk%2F1.3.1...sdk%2F1.3.2
[1.3.1]: https://github.com/polarsource/polar/compare/sdk%2F1.3.0...sdk%2F1.3.1
[1.3.0]: https://github.com/polarsource/polar/compare/sdk%2F1.2.0...sdk%2F1.3.0
[1.2.0]: https://github.com/polarsource/polar/compare/sdk%2F1.1.0...sdk%2F1.2.0
[1.1.0]: https://github.com/polarsource/polar/compare/sdk%2F1.0.2...sdk%2F1.1.0
[1.0.2]: https://github.com/polarsource/polar/compare/sdk%2F1.0.1...sdk%2F1.0.2
[1.0.1]: https://github.com/polarsource/polar/compare/sdk%2F1.0.0...sdk%2F1.0.1
[1.0.0]: https://github.com/polarsource/polar/compare/sdk%2F1.0.0-alpha.22...sdk%2F1.0.0
[1.0.0-alpha.22]: https://github.com/polarsource/polar/releases/tag/sdk%2F1.0.0-alpha.22
