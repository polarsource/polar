# Changelog

All notable changes to the Polar SDKs will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Entries apply to all SDKs unless prefixed with a language name, such as `Python:` or `TypeScript:`.
History up to [1.0.0-alpha.22] is available in the existing GitHub releases.

## [Unreleased]

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

[Unreleased]: https://github.com/polarsource/polar/compare/sdk%2F1.0.2...HEAD
[1.0.2]: https://github.com/polarsource/polar/compare/sdk%2F1.0.1...sdk%2F1.0.2
[1.0.1]: https://github.com/polarsource/polar/compare/sdk%2F1.0.0...sdk%2F1.0.1
[1.0.0]: https://github.com/polarsource/polar/compare/sdk%2F1.0.0-alpha.22...sdk%2F1.0.0
[1.0.0-alpha.22]: https://github.com/polarsource/polar/releases/tag/sdk%2F1.0.0-alpha.22
