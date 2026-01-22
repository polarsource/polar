---
'@polar-sh/checkout': minor
---

Add onLoaded option on `PolarEmbedCheckout.create` to wire a loaded event listener, ensuring it's always executed, even if the checkout loads very quickly.

**Breaking change**

The theme should now be passed in an object when calling `PolarEmbedCheckout.create`:

```ts
PolarEmbedCheckout.create('__CHECKOUT_LINK__', { theme: 'dark' })
```
