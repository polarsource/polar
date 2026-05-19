# `@polar-sh/checkout`

JavaScript utilities for embedding Polar into your website. Drop in the single CDN script (auto-init) or import per-feature from npm for tree-shaking.

## Payment Method

### Modal — vanilla JS

```ts
import { PolarEmbedPaymentMethod } from '@polar-sh/checkout/payment-method'

const embed = await PolarEmbedPaymentMethod.create({
  customerSessionToken, // or memberSessionToken — see below
  theme: 'light',
})

embed.addEventListener('success', (event) => {
  console.log('Attached:', event.detail.paymentMethodId)
})
```

### Inline — React

```tsx
import { PolarPaymentMethod } from '@polar-sh/checkout/react/payment-method'
;<PolarPaymentMethod
  customerSessionToken={token} // or memberSessionToken
  onSuccess={(id) => console.log('Attached:', id)}
/>
```

### Auto-init via data attribute

```html
<script
  defer
  data-auto-init
  src="https://cdn.jsdelivr.net/npm/@polar-sh/checkout@latest/dist/embed.global.js"
></script>

<button data-polar-payment-method="polar_cst_xxx">Add payment method</button>
```

### Tokens

`POST /v1/customer-sessions` returns one of two prefixes depending on whether the organisation uses the member model. Pass exactly one option:

- `polar_cst_*` → `customerSessionToken`
- `polar_mst_*` → `memberSessionToken`

The auto-init data attribute accepts either prefix — the SDK detects it.
