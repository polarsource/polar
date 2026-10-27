---
'@polar-sh/checkout': patch
---

The checkout form reads the billing country, discount code and tax ID through `useWatch` and its errors through `useFormState`, so it stays reactive when bundled with the React Compiler.
