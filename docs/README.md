# Polar docs

Using Mintlify.

**Core concepts**

- `docs.json` contains [navigation](https://mintlify.com/docs/navigation/overview), [redirects](https://mintlify.com/docs/settings/broken-links) and core settings

## Development

**Installation**

```bash
pnpm install
```

**Development Server**

```bash
pnpm dev
```

## Acceptable Use Policy

The docs policy is generated from the website's legal policy at
`clients/apps/web/src/app/(main)/(website)/(landing)/(mdx)/legal/acceptable-use-policy/page.mdx`.
After updating that source, run `pnpm sync:aup` from this directory and include the
generated `merchant-of-record/acceptable-use.mdx` in the same change.

The generator preserves the policy wording and effective date, adapts the layout
for Mintlify, and uses absolute legal links. It also points the source's legacy
Master Services Agreement link to the current Master Services Terms page.
Run `pnpm check:aup` to check synchronization; CI runs the same check.
