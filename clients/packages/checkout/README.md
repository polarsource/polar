# `@polar-sh/checkout`

JavaScript utilities for embedding Polar into your website. Drop in the single CDN script (auto-init) or import per-feature from npm for tree-shaking.

## Payment Method

A customer session token authenticates every embed. Create it **on your server** — your Polar access token must stay secret — then hand the token to the browser. The SDK accepts either a `polar_cst_*` or `polar_mst_*` prefix and routes internally.

### Javascript

#### Modal

A full-screen overlay the SDK creates and tears down for you — open it on demand, e.g. from a button click.

```ts
import { Polar } from '@polar-sh/sdk'
import { PolarEmbedPaymentMethod } from '@polar-sh/checkout/payment-method'

const polar = new Polar({ accessToken: process.env.POLAR_ACCESS_TOKEN })
const session = await polar.customerSessions.create({
  customerId: 'ABC-123',
})

const embed = await PolarEmbedPaymentMethod.create({
  sessionToken: session.token,
})

embed.addEventListener('success', (event) => {
  console.log('Attached:', event.detail.paymentMethodId)
})
```

#### `create()` options

| Option         | Type                           | Default     | Description                                                                                                                                                           |
| -------------- | ------------------------------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sessionToken` | `string`                       | —           | **Required.** Session token from `POST /v1/customer-sessions` (`polar_cst_*` or `polar_mst_*`).                                                                       |
| `theme`        | `'light' \| 'dark'`            | `light`     | Colour scheme for the embed.                                                                                                                                          |
| `setAsDefault` | `boolean`                      | `true`      | Whether the new card should become the customer's default payment method.                                                                                             |
| `returnUrl`    | `string`                       | current URL | Where to return the customer after a redirect-based payment method (Amazon Pay etc). Defaults to `window.location.href`. See [Redirect re-entry](#redirect-re-entry). |
| `locale`       | `string`                       | `'en'`      | BCP47 locale for the embed UI and Stripe Elements (e.g. `'en'`, `'fr-FR'`). Unsupported locales fall back to English.                                                 |
| `onLoaded`     | `(event: CustomEvent) => void` | —           | Convenience callback for the `loaded` event. Equivalent to `embed.addEventListener('loaded', …)`.                                                                     |

#### Inline

A chrome-less, auto-resizing iframe mounted into an element you control — compose it into your own layout.

```ts
import { Polar } from '@polar-sh/sdk'
import { PolarEmbedPaymentMethod } from '@polar-sh/checkout/payment-method'

const polar = new Polar({ accessToken: process.env.POLAR_ACCESS_TOKEN })
const session = await polar.customerSessions.create({
  customerId: 'ABC-123',
})

const embed = PolarEmbedPaymentMethod.createInline({
  sessionToken: session.token,
  element: document.getElementById('polar-payment-method')!,
})

embed.addEventListener('success', (event) => {
  console.log('Attached:', event.detail.paymentMethodId)
})
```

#### `createInline()` options

| Option         | Type                           | Default | Description                                                                                       |
| -------------- | ------------------------------ | ------- | ------------------------------------------------------------------------------------------------- |
| `sessionToken` | `string`                       | —       | **Required.** Session token from `POST /v1/customer-sessions` (`polar_cst_*` or `polar_mst_*`).   |
| `element`      | `HTMLElement`                  | —       | **Required.** The element to mount the embed into. Any existing children are replaced.            |
| `theme`        | `'light' \| 'dark'`            | `light` | Colour scheme for the embed.                                                                      |
| `setAsDefault` | `boolean`                      | `true`  | Whether the new card should become the customer's default payment method.                         |
| `locale`       | `string`                       | `'en'`  | BCP47 locale for the embed UI and Stripe Elements. Unsupported locales fall back to English.      |
| `onLoaded`     | `(event: CustomEvent) => void` | —       | Convenience callback for the `loaded` event. Equivalent to `embed.addEventListener('loaded', …)`. |

#### Events

All events are dispatched as cancelable `CustomEvent`s on the `embed` instance. Call `event.preventDefault()` to opt out of the SDK's default action.

| Event       | Detail                        | Default action                                                        |
| ----------- | ----------------------------- | --------------------------------------------------------------------- |
| `loaded`    | —                             | Removes the loader spinner once the iframe is ready.                  |
| `close`     | —                             | Tears down the iframe (unless locked by a pending `confirmed`).       |
| `confirmed` | —                             | Marks the modal as non-closable while Stripe is processing.           |
| `success`   | `{ paymentMethodId: string }` | **Auto-closes the modal.** Call `preventDefault()` to keep it open.   |
| `error`     | `{ code: ErrorCode }`         | None. `ErrorCode = 'invalid_request' \| 'unauthorized' \| 'processing_failed' \| 'unknown'`. |

#### Instance methods

| Method                                      | Description                                             |
| ------------------------------------------- | ------------------------------------------------------- |
| `embed.close()`                             | Programmatically close the modal and remove the iframe. |
| `embed.addEventListener(type, listener)`    | Subscribe to an event. Returns `void`.                  |
| `embed.removeEventListener(type, listener)` | Unsubscribe.                                            |

#### Redirect re-entry

Redirect-based payment methods (Amazon Pay etc, etc) authorise on the provider's own site — the browser navigates the whole tab away and back to `returnUrl` (defaults to the page the SDK was opened from), so the modal can't survive the round-trip. Read the outcome on the returned page with the static `getRedirectResult()`:

```ts
const result = PolarEmbedPaymentMethod.getRedirectResult()
// result: { status: 'succeeded' | 'failed' } | null

if (result?.status === 'succeeded') {
  // refresh the customer's payment methods
}
```

It strips the status param from the URL so a refresh won't resurface a stale result. Card payments (3DS) complete inside the modal and never trigger this path.

### React

#### Modal

Open the full-screen modal with `PolarEmbedPaymentMethod.create()` — the same API as vanilla JS, called from a Client Component event handler.

```tsx
import { Polar } from '@polar-sh/sdk'
import { PolarEmbedPaymentMethod } from '@polar-sh/checkout/payment-method'

export function AddPaymentMethodButton({
  sessionToken,
}: {
  sessionToken: string
}) {
  const polar = new Polar({ accessToken: process.env.POLAR_ACCESS_TOKEN })
  const session = await polar.customerSessions.create({
    customerId: 'ABC-123',
  })

  const openEmbed = async () => {
    const embed = await PolarEmbedPaymentMethod.create({ sessionToken })
    embed.addEventListener('success', (event) => {
      console.log('Attached:', event.detail.paymentMethodId)
    })
  }

  return <button onClick={openEmbed}>Add payment method</button>
}
```

#### Inline

Render `<PolarPaymentMethod />` for a chrome-less, auto-resizing embed inside your own layout.

```tsx
import { Polar } from '@polar-sh/sdk'
import { PolarPaymentMethod } from '@polar-sh/checkout/react/payment-method'

const polar = new Polar({ accessToken: process.env.POLAR_ACCESS_TOKEN })
const session = await polar.customerSessions.create({
  customerId: 'ABC-123',
})

return (
  <PolarPaymentMethod
    sessionToken={session.token}
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
| `locale`       | `string`                            | `'en'`  | BCP47 locale (e.g. `'en'`, `'fr-FR'`). Unsupported locales fall back to English.  |
| `onLoaded`     | `() => void`                        | —       | Fires once when the iframe finishes loading and the form becomes interactive.     |
| `onConfirmed`  | `() => void`                        | —       | Fires when the customer submits and Stripe processing starts.                     |
| `onSuccess`    | `(paymentMethodId: string) => void` | —       | Fires after the card has been attached to the customer.                           |
| `onError`      | `(code: ErrorCode) => void`         | —       | Fires when the iframe can't render or the payment-method flow fails. `ErrorCode` as above. |
| `className`    | `string`                            | —       | Applied to the wrapping `<div>`. Use it to size or position the embed.            |
| `style`        | `React.CSSProperties`               | —       | Inline style on the wrapping `<div>`.                                             |

#### Redirect re-entry

Redirect-based payment methods (Amazon Pay etc etc.) navigate the whole tab away to the provider and back. Read the outcome on the returned page with the `usePaymentMethodRedirectResult` hook:

```tsx
import { usePaymentMethodRedirectResult } from '@polar-sh/checkout/react/payment-method'

usePaymentMethodRedirectResult({
  onSuccess: () => toast('Payment method added'),
  onError: () => toast('Could not add payment method'),
})
```

It reads the result once on mount and strips the status param from the URL. Card payments (3DS) complete inside the embed and never trigger this path.

### Code snippet

```ts
import { Polar } from '@polar-sh/sdk'

const polar = new Polar({ accessToken: process.env.POLAR_ACCESS_TOKEN })
const session = await polar.customerSessions.create({
  customerId: 'ABC-123',
})
```

```html
<script
  defer
  data-auto-init
  src="https://cdn.jsdelivr.net/npm/@polar-sh/checkout@latest/dist/embed.global.js"
></script>

<!-- session.token rendered into the attribute server-side -->
<button data-polar-payment-method="polar_cst_…">Add payment method</button>
```

The same script also powers `PolarEmbedCheckout` triggers — one tag covers every Polar embed.

#### Attributes

| Attribute                                  | Value           | Description                                                                                        |
| ------------------------------------------ | --------------- | -------------------------------------------------------------------------------------------------- |
| `data-polar-payment-method`                | `string`        | **Required.** The session token. Clicking the element opens the modal.                             |
| `data-polar-payment-method-theme`          | `light \| dark` | Optional theme override.                                                                           |
| `data-polar-payment-method-set-as-default` | `true \| false` | Optional. Default `true`. Passing `"false"` adds the card without overriding the existing default. |
| `data-polar-payment-method-return-url`     | `string`        | Optional. Return URL for redirect-based payment methods. Defaults to the current page.             |
| `data-polar-payment-method-locale`         | `string`        | Optional. BCP47 locale (e.g. `'en'`, `'fr-FR'`). Unsupported locales fall back to English.         |
