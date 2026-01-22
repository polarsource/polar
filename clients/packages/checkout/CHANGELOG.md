# @polar-sh/checkout

## 0.2.0

### Minor Changes

- f8bc897: Add onLoaded option on `PolarEmbedCheckout.create` to wire a loaded event listener, ensuring it's always executed, even if the checkout loads very quickly.

  **Breaking change**

  The theme should now be passed in an object when calling `PolarEmbedCheckout.create`:

  ```ts
  PolarEmbedCheckout.create('__CHECKOUT_LINK__', { theme: 'dark' })
  ```

## 0.1.15

### Patch Changes

- d283219: Fix event handler accumulation when creating multiple EmbedCheckout instances by properly removing window message listeners on close

## 0.1.14

### Patch Changes

- d9a45ea: Bump dependencies and setup trusted publishing
- 258bdb1: Dependency upgrades, including React 19 peer dependency support
- Updated dependencies [258bdb1]
  - @polar-sh/ui@0.1.2

## 0.1.13

### Patch Changes

- f22a0d1: Update Polar SDK

## 0.1.12

### Patch Changes

- 4d49e8f: Fix console error when the iframe is already closed

## 0.1.11

### Patch Changes

- 664460e: Tweak allow policy on iframe

## 0.1.10

### Patch Changes

- 15e0267: Allow React 19 as a peer dependency

## 0.1.9

### Patch Changes

- de906a0: Handle case where the checkout element might have nested elements triggering the click event

## 0.1.8

### Patch Changes

- d623321: Add permissions policy to the iframe for better compatibility with wallet payment methods

## 0.1.7

### Patch Changes

- 2811f8a: Prevent embed to be closed while checkout is processing payment

## 0.1.6

### Patch Changes

- 8c2db45: Darken iframe backdrop

## 0.1.5

### Patch Changes

- fabadac: Tweak authorized origins variable name

## 0.1.4

### Patch Changes

- 6421c8d: - Fix backdrop not correctly rendered with forced dark schemes
  - Improve internals for events handling

## 0.1.3

### Patch Changes

- e67a4cb: Implement security mechanism to avoid XSS vulnerabilities
- 4bb3bb3: prevent `init()` from wiring the click event listener several times

## 0.1.2

### Patch Changes

- ef574b4: - Prevent background page from scrolling while checkout is shown
  - Tweak backdrop and loader
  - Add a method to run initialization logic manually

## 0.1.1

### Patch Changes

- 7ccc8a8: Bump to make CI and tagging back on track

## 0.1.0

### Minor Changes

- d2ec431: Initial release

## 0.1.0

### Minor Changes

- Initial release of @polar-sh/checkout
