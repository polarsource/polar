# `@polar-sh/checkout`

JavaScript utilities for embedding Polar into your website. Drop in the single CDN script (auto-init) or import per-feature from npm for tree-shaking.

## Payment Method

Pass the `token` returned by `POST /v1/customer-sessions` — the SDK accepts either `polar_cst_*` or `polar_mst_*` prefix and routes internally.

### Modal — vanilla JS

```ts
import { PolarEmbedPaymentMethod } from '@polar-sh/checkout/payment-method'

const embed = await PolarEmbedPaymentMethod.create({
  sessionToken,
  theme: 'light',
})

embed.addEventListener('success', (event) => {
  console.log('Attached:', event.detail.paymentMethodId)
})
```

#### `create()` options

| Option         | Type                           | Default | Description                                                                                       |
| -------------- | ------------------------------ | ------- | ------------------------------------------------------------------------------------------------- |
| `sessionToken` | `string`                       | —       | **Required.** Session token from `POST /v1/customer-sessions` (`polar_cst_*` or `polar_mst_*`).   |
| `theme`        | `'light' \| 'dark'`            | `light` | Colour scheme for the embed.                                                                      |
| `setAsDefault` | `boolean`                      | `true`  | Whether the new card should become the customer's default payment method.                         |
| `onLoaded`     | `(event: CustomEvent) => void` | —       | Convenience callback for the `loaded` event. Equivalent to `embed.addEventListener('loaded', …)`. |

#### Events

All events are dispatched as cancelable `CustomEvent`s on the `embed` instance. Call `event.preventDefault()` to opt out of the SDK's default action.

| Event       | Detail                        | Default action                                                        |
| ----------- | ----------------------------- | --------------------------------------------------------------------- |
| `loaded`    | —                             | Removes the loader spinner once the iframe is ready.                  |
| `close`     | —                             | Tears down the iframe (unless locked by a pending `confirmed`).       |
| `confirmed` | —                             | Marks the modal as non-closable while Stripe is processing.           |
| `success`   | `{ paymentMethodId: string }` | **Auto-closes the modal.** Call `preventDefault()` to keep it open.   |
| `error`     | `{ code: ErrorCode }`         | None. `ErrorCode = 'invalid_request' \| 'unauthorized' \| 'unknown'`. |

#### Instance methods

| Method                                      | Description                                             |
| ------------------------------------------- | ------------------------------------------------------- |
| `embed.close()`                             | Programmatically close the modal and remove the iframe. |
| `embed.addEventListener(type, listener)`    | Subscribe to an event. Returns `void`.                  |
| `embed.removeEventListener(type, listener)` | Unsubscribe.                                            |

### Inline — React

```tsx
import { PolarPaymentMethod } from '@polar-sh/checkout/react/payment-method'

return (
  <PolarPaymentMethod
    sessionToken={token}
    onSuccess={(id) => console.log('Attached:', id)}
  />
)
```

#### Props

| Prop           | Type                                | Default | Description                                                                       |
| -------------- | ----------------------------------- | ------- | --------------------------------------------------------------------------------- |
| `sessionToken` | `string`                            | —       | **Required.** Session token from `POST /v1/customer-sessions`.                    |
| `theme`        | `'light' \| 'dark'`                 | `light` | Colour scheme.                                                                    |
| `setAsDefault` | `boolean`                           | `true`  | Whether the new card should become the customer's default payment method.         |
| `onLoaded`     | `() => void`                        | —       | Fires once when the iframe finishes loading and the form becomes interactive.     |
| `onConfirmed`  | `() => void`                        | —       | Fires when the customer submits and Stripe processing starts.                     |
| `onSuccess`    | `(paymentMethodId: string) => void` | —       | Fires after the card has been attached to the customer.                           |
| `onError`      | `(code: ErrorCode) => void`         | —       | Fires when the iframe can't render (token missing/expired). `ErrorCode` as above. |
| `className`    | `string`                            | —       | Applied to the wrapping `<div>`. Use it to size or position the embed.            |
| `style`        | `React.CSSProperties`               | —       | Inline style on the wrapping `<div>`.                                             |

### Auto-init via data attribute

```html
<script
  defer
  data-auto-init
  src="https://cdn.jsdelivr.net/npm/@polar-sh/checkout@latest/dist/embed.global.js"
></script>

<button data-polar-payment-method="polar_cst_xxx">Add payment method</button>
```

The same script also powers `PolarEmbedCheckout` triggers — one tag covers every Polar embed.

#### Attributes

| Attribute                                  | Value           | Description                                                                                        |
| ------------------------------------------ | --------------- | -------------------------------------------------------------------------------------------------- |
| `data-polar-payment-method`                | `string`        | **Required.** The session token. Clicking the element opens the modal.                             |
| `data-polar-payment-method-theme`          | `light \| dark` | Optional theme override.                                                                           |
| `data-polar-payment-method-set-as-default` | `true \| false` | Optional. Default `true`. Passing `"false"` adds the card without overriding the existing default. |
