# @polar-sh/hono

## 1.9.0

### Minor Changes

- 10d913c: Add experimental support for mapping Better Auth organizations to Polar team billing, including automatic recurring product-seat checkout sizing, assignment, revocation, and subscription quantity synchronization.

  Enable organization synchronization with Better Auth's `organization` plugin and `experimental_organizationSync.enabled`. Automatic seat management is separately opt-in with `experimental_organizationSync.syncSeats`; use `experimental_organizationSync.selectSeatProductsForMember` to configure dynamic per-member product allocation.

  Do not enable this option if the application already synchronizes organization billing, because competing implementations can leave Better Auth and Polar in an inconsistent state.

## 1.8.4

### Patch Changes

- 6f675f4: Fix circular dependency between `client.ts` and `index.ts` that caused type inference issues for `$InferServerPlugin`
- 9b0cf46: Update @polar-sh/sdk to 0.46.5
- fbb9c4c: Update @polar-sh/sdk to 0.46.7
- a89b1ee: Update @polar-sh/sdk to 0.47.0
- 19b0f48: Update @polar-sh/sdk to 0.46.6

## 1.8.3

### Patch Changes

- cfbb6ed: Update @polar-sh/sdk to 0.46.4
- 0e8d982: Update @polar-sh/sdk to 0.46.2
- 3f2cce5: Update @polar-sh/sdk to 0.46.3

## 1.8.2

### Patch Changes

- 43ff4ac: Update @polar-sh/sdk to 0.46.0

## 1.8.1

### Patch Changes

- 569d831: Update deprecated `createAuthEndpoint` import for compatibility with 1.5.0-beta

## 1.8.0

### Minor Changes

- 04156c1: Support `{ redirect: false }` on `authClient.customer.portal()` to generate a link without redirecting
- 48cdd1c: Adds theme to the portal hook
- 6905772: Accept custom `successUrl` and `returnUrl` on `authClient.checkout({})` calls

### Patch Changes

- 548c814: Skip creating customers for anonymous users
- 4a05db6: Remove unused `redirect` option on checkout plugin, keeping only on `authClient.checkout()` arguments
- c5a8eba: Fix `checkout` & `portal` integration for anonymous users

## 1.7.0

### Minor Changes

- a2e1a44: Match `metadata` validation with the API validation
- 1eae6e7: Support trial configuration on checkouts

### Patch Changes

- 0172ee2: Update dependencies

## 1.6.4

### Patch Changes

- e6fb64a: Update Better-Auth minimum version to double-check type issues

## 1.6.3

### Patch Changes

- 3906ed9: Bump @polar-sh/sdk

## 1.6.2

### Patch Changes

- c591126: Bump @polar-sh/sdk

## 1.6.1

### Patch Changes

- 55f13ed: Re-export the `PolarEmbedCheckout` type

## 1.6.0

### Minor Changes

- b658623: Upgrade dependencies

### Patch Changes

- 85c32f7: Add clients-only export as `@polar/better-auth/client`

## 1.5.0

### Minor Changes

- 266eba1: Bump Polar SDK
- 4512e82: Bump Polar SDK

## 1.4.0

### Minor Changes

- 69eb956: Adds `OnOrderUpdated` Webhook support

### Patch Changes

- 45a7a63: Do not attempt to create customer that already exist
- 96c6b83: Implements user deletion hook
- c6f30a7: Skips duplicate customer creation in better-auth plugin

## 1.3.0

### Minor Changes

- 6c46bd1: feat: add seats param to checkout

## 1.2.1

### Patch Changes

- 81e9926: Upgrade dependencies, list Next.js 16 as supported peer dependency

## 1.2.0

### Minor Changes

- 1deb3b3: Update sdk to 0.40.2

## 1.1.11

### Patch Changes

- 3250323: Update Polar SDK to 0.38.1

## 1.1.10

### Patch Changes

- a84c64c: Add support for returnUrl

## 1.1.9

### Patch Changes

- 3713498: Bump BetterAuth adapter dependencies

## 1.1.8

### Patch Changes

- 95c76db: Bump BetterAuth adapter dependencies

## 1.1.7

### Patch Changes

- 6621c94: Implement Checkout Embed

## 1.1.6

### Patch Changes

- bcad48d: Fix problem with imports that may have caused build issues with Vite or other bundlers
- b537f07: Fall back to base URL when creating a checkout on the server outside of a request context.
- 6f658a8: Add support for Zod v4

## 1.1.5

### Patch Changes

- 3ef623b: Bump SDK version

## 1.1.4

### Patch Changes

- 377e07e: Add refund webhooks
- 54d368c: Bump SDK version

## 1.1.3

### Patch Changes

- 78a922c: Add refund webhooks

## 1.1.2

### Patch Changes

- 5817078: Update better auth version
- a04c344: Fix type of User in getCustomerCreateParams
- 39f4d39: Update Polar SDK version

## 1.1.1

### Patch Changes

- a34a7c2: Make sure to interrupt user creation if Polar customer creation fails

## 1.1.0

### Minor Changes

- 9cd2520: Adds `discountId` and `allowDiscountCodes` to the `checkout` plugin

## 1.0.8

### Patch Changes

- bdd7635: Bump SDK Dependency

## 1.0.7

### Patch Changes

- d60f171: Update package.json

## 1.0.6

### Patch Changes

- bf04d3a: Fix issue with SDK mistakenly resolving Zod v4

## 1.0.5

### Patch Changes

- b27ce7d: Upgrade zod dependency

## 1.0.4

### Patch Changes

- 1b25168: Add theme-support to Checkout configs

## 1.0.3

### Patch Changes

- b098cbe: Fix async issue with webhook handler

## 1.0.2

### Patch Changes

- 87de0c5: Bump Polar SDK

## 1.0.1

### Patch Changes

- 2211b0a: Fix issue with getCustomerCreateParams option

## 1.0.0

### Major Changes

- 04e6c50: Add proper BetterAuth plugin with org support, client support, portal, etc.

## 0.1.2

### Patch Changes

- ef8e777: Add authenticatedUsersOnly option and onOrderPaid hook
- 1754b38: add authcheck to slugcheckout

## 0.1.1

### Patch Changes

- 313b572: Fix query param parser in products endpoint

## 0.1.0

### Minor Changes

- 70362f0: ## Breaking changes

  Checkout endpoints no longer support `productId` and `productPriceId` parameter to pass the product. Use `products` instead.

  ## Added

  Checkout endpoints now support the `products` parameter. You can repeat it to pass several products to the Checkout session.

## 0.0.11

### Patch Changes

- fc6c8a6: Throw API error when customer creation fails

## 0.0.10

### Patch Changes

- f2433b0: fix webhooks imports

## 0.0.9

### Patch Changes

- ff2ce69: Add new order webhook support

## 0.0.8

### Patch Changes

- e5bb5e9: Fix checkout route

## 0.0.7

### Patch Changes

- 32f64b5: graceful customer creation

## 0.0.6

### Patch Changes

- c9daadf: Bump SDK version

## 0.0.5

### Patch Changes

- e49adbe: Add polar sdk as peer dep

## 0.0.4

### Patch Changes

- 0f1ca22: Add customer state support

## 0.0.3

### Patch Changes

- e806c01: Add support for Customer State

## 0.0.2

### Patch Changes

- 4407e6c: Init Better Auth plugin

## 0.2.18

### Patch Changes

- Updated dependencies [be7db19]
  - @polar-sh/adapter-utils@0.1.12

## 0.2.17

### Patch Changes

- Updated dependencies [f798821]
  - @polar-sh/adapter-utils@0.1.11

## 0.2.16

### Patch Changes

- Updated dependencies [7922261]
- Updated dependencies [e7a7352]
  - @polar-sh/adapter-utils@0.1.10

## 0.2.15

### Patch Changes

- 845f91d: Upgrade SDK usage
- Updated dependencies [845f91d]
  - @polar-sh/adapter-utils@0.1.9

## 0.2.14

### Patch Changes

- 9dd847d: Bump Polar SDK
- Updated dependencies [9dd847d]
  - @polar-sh/adapter-utils@0.1.8

## 0.2.13

### Patch Changes

- 1d6d075: decode the URI properly
- Updated dependencies [1d6d075]
  - @polar-sh/adapter-utils@0.1.7

## 0.2.12

### Patch Changes

- b002bc1: export types
- Updated dependencies [b002bc1]
  - @polar-sh/adapter-utils@0.1.6

## 0.2.11

### Patch Changes

- 350a4e8: Export entitlement utils
- Updated dependencies [350a4e8]
  - @polar-sh/adapter-utils@0.1.5

## 0.2.10

### Patch Changes

- 2ec8d0d: implement entitlements
- Updated dependencies [2ec8d0d]
  - @polar-sh/adapter-utils@0.1.4

## 0.2.9

### Patch Changes

- f732797: Exports Entitlement class
- Updated dependencies [f732797]
  - @polar-sh/adapter-utils@0.1.3

## 0.2.8

### Patch Changes

- 4038228: make sure to pass either price or product in checkout
- Updated dependencies [4038228]
  - @polar-sh/adapter-utils@0.1.2

## 0.2.7

### Patch Changes

- 2746035: Add productPriceId param capability

## 0.2.6

### Patch Changes

- aa6b311: init adapter-utils
- abd0e90: fix utils
- aa6b311: resolve core from workspace
- Updated dependencies [aa6b311]
- Updated dependencies [abd0e90]
- Updated dependencies [aa6b311]
  - @polar-sh/adapter-utils@0.1.1

## 0.2.5

### Patch Changes

- 234ba51: resolve core from workspace
- Updated dependencies [49d21c1]
- Updated dependencies [234ba51]
  - @polar-sh/adapter-core@0.1.5

## 0.2.4

### Patch Changes

- 98a1bf9: add core dependency
- Updated dependencies [98a1bf9]
  - @polar-sh/adapter-utils@0.1.3

## 0.2.3

### Patch Changes

- Updated dependencies [4abbedc]
  - @polar-sh/adapter-utils@0.1.2

## 0.2.2

### Patch Changes

- 46ad781: Await webhook handlers
- Updated dependencies [46ad781]
  - @polar-sh/adapter-utils@0.1.1

## 0.2.1

### Patch Changes

- dda069d: Add granular webhook handlers

## 0.2.0

### Minor Changes

- eb28d55: Add CommonJS module and Sourcemaps

## 0.1.4

### Patch Changes

- fd20c5a: fix biome

## 0.1.3

### Patch Changes

- 698e06c: fix webhooks
- 698e06c: fix types

## 0.1.2

### Patch Changes

- 8996fa7: add tsup

## 0.1.1

### Patch Changes

- e4fc754: init
