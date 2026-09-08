---
'@polar-sh/checkout': patch
---

Fix a debounce coalescing race in `CheckoutForm` that prevented a billing country change from clearing the tax ID when another address field was edited within the 500 ms debounce window. The debounced watcher branches on the last changed field's name, so a country change followed quickly by another address-field edit took the `customer_billing_address.*` branch and sent the new country without `customer_tax_id: null`. The server then re-validated the stale tax ID against the new country and rejected the update with "Invalid tax ID", leaving the form and server out of sync. The tax-ID-clearing side effects now also run in the coalesced branch when the new country differs from the last persisted checkout country.
