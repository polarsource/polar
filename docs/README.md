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

### Update schema and webhooks

We have a script that takes care of:

* Downloading latest schema with Speakeasy overlays
* Generate missing webhooks schema pages
    * By default, new pages are added at the bottom of the `Webhooks Events` navigation section, but you can move them to a specific group if needed.
    * Existing pages are not updated, so you can safely edit them without losing your changes.

```bash
./update-schema.sh https://spec.speakeasy.com/polar/polar/polar-oas-with-code-samples
```

The script is run automatically by the CI pipeline every day and opens a PR if there are changes.
