# Polar TypeScript SDK

The official TypeScript client for the [Polar API](https://polar.sh/docs/api-reference).

## Installation

```bash
pnpm add @polar-sh/sdk
```

or, with `npm`:

```bash
npm install @polar-sh/sdk
```

## Quick Start

Create an [organization access token](https://polar.sh/docs/integrate/oat) and use the client for
the current API version:

```typescript
import { createPolar } from "@polar-sh/sdk/{{ ir.versions[0].version }}";

const polar = createPolar({
  accessToken: "polar_oat_xxx",
});

const customerState = await polar.customers.getStateExternal("customer_external_id");
console.log(customerState);
```

The client uses the production environment by default. To use the sandbox, pass
`environment: "sandbox"` to `createPolar`. Sandbox and production access tokens are separate.

Keep organization access tokens on the server and never expose them in browser or client-side
code.

## Individual API Functions

To import individual API functions for tree-shaking, create a core client and pass it to the
function:

```typescript
import { createPolarCore } from "@polar-sh/sdk/{{ ir.versions[0].version }}";
import { listProducts } from "@polar-sh/sdk/{{ ir.versions[0].version }}/services/products";

const polar = createPolarCore({
  accessToken: "polar_oat_xxx",
});

const products = await listProducts(polar)({ limit: 10 });
```
