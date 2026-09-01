# @polar-sh/adapter-utils

## 0.4.7

### Patch Changes

- 10d913c: Add typed handlers for Polar member created, updated, deleted, customer seat assigned, claimed, and revoked webhook events.

## 0.4.6

### Patch Changes

- 9b0cf46: Update @polar-sh/sdk to 0.46.5
- fbb9c4c: Update @polar-sh/sdk to 0.46.7
- a89b1ee: Update @polar-sh/sdk to 0.47.0
- 19b0f48: Update @polar-sh/sdk to 0.46.6

## 0.4.5

### Patch Changes

- 0e8d982: Update @polar-sh/sdk to 0.46.2

## 0.4.4

### Patch Changes

- 43ff4ac: Update @polar-sh/sdk to 0.46.0

## 0.4.3

### Patch Changes

- 3906ed9: Bump @polar-sh/sdk

## 0.4.2

### Patch Changes

- c591126: Bump @polar-sh/sdk

## 0.4.1

### Patch Changes

- b658623: Upgrade dependencies

## 0.4.0

### Minor Changes

- 4512e82: Bump Polar SDK

## 0.3.0

### Minor Changes

- 1deb3b3: Update sdk to 0.40.2

## 0.2.10

### Patch Changes

- 3250323: Update Polar SDK to 0.38.1

## 0.2.9

### Patch Changes

- a84c64c: Add support for returnUrl

## 0.2.8

### Patch Changes

- bcad48d: Fix problem with imports that may have caused build issues with Vite or other bundlers

## 0.2.7

### Patch Changes

- 3ef623b: Bump SDK version

## 0.2.6

### Patch Changes

- 377e07e: Add refund webhooks
- 54d368c: Bump SDK version

## 0.2.5

### Patch Changes

- 78a922c: Add refund webhooks
- e98e50b: fix: Ensure `uncanceled` webhooks are handled

## 0.2.4

### Patch Changes

- 39f4d39: Update Polar SDK version

## 0.2.3

### Patch Changes

- bdd7635: Bump SDK Dependency

## 0.2.2

### Patch Changes

- bf04d3a: Fix issue with SDK mistakenly resolving Zod v4

## 0.2.1

### Patch Changes

- 87de0c5: Bump Polar SDK

## 0.2.0

### Minor Changes

- 70362f0: ## Breaking changes

  Checkout endpoints no longer support `productId` and `productPriceId` parameter to pass the product. Use `products` instead.

  ## Added

  Checkout endpoints now support the `products` parameter. You can repeat it to pass several products to the Checkout session.

## 0.1.15

### Patch Changes

- ff2ce69: Add new order webhook support

## 0.1.14

### Patch Changes

- c9daadf: Bump SDK version

## 0.1.13

### Patch Changes

- 0f1ca22: Add customer state support

## 0.1.12

### Patch Changes

- be7db19: Move ingestion to separate package

## 0.1.11

### Patch Changes

- f798821: add support for usage in nextjs adapter

## 0.1.10

### Patch Changes

- 7922261: fix pkgs
- e7a7352: add usage utils

## 0.1.9

### Patch Changes

- 845f91d: Upgrade SDK usage

## 0.1.8

### Patch Changes

- 9dd847d: Bump Polar SDK

## 0.1.7

### Patch Changes

- 1d6d075: decode the URI properly

## 0.1.6

### Patch Changes

- b002bc1: export types

## 0.1.5

### Patch Changes

- 350a4e8: Export entitlement utils

## 0.1.4

### Patch Changes

- 2ec8d0d: implement entitlements

## 0.1.3

### Patch Changes

- f732797: Exports Entitlement class

## 0.1.2

### Patch Changes

- 4038228: make sure to pass either price or product in checkout

## 0.1.1

### Patch Changes

- aa6b311: init adapter-utils
- abd0e90: fix utils
- aa6b311: resolve core from workspace

## 0.1.5

### Patch Changes

- 49d21c1: bump version
- 234ba51: resolve core from workspace

## 0.1.3

### Patch Changes

- 98a1bf9: add core dependency

## 0.1.2

### Patch Changes

- 4abbedc: publish core

## 0.1.1

### Patch Changes

- 46ad781: Await webhook handlers
