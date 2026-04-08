# Polar docs

Using Mintlify.

**Core concepts**
- `docs.json` contains [navigation](https://mintlify.com/docs/navigation/overview), [redirects](https://mintlify.com/docs/settings/broken-links) and core settings

## Development

**Installation**
```bash Terminal
pnpm install
```

**Development Server**
```bash Terminal
pnpm dev
```

### Update schema and webhooks

We have a script that takes care of:

* Downloading latest schema with Speakeasy overlays
* Generate missing webhooks schema pages
    * By default, new pages are added at the bottom of the `Webhooks Events` navigation section, but you can move them to a specific group if needed.
    * Existing pages are not updated, so you can safely edit them without losing your changes.

```bash Terminal
./update-schema.sh https://spec.speakeasy.com/polar/polar/polar-oas-with-code-samples
```

The script is run automatically by the CI pipeline every day and opens a PR if there are changes.

## Help Center (`help-center/`)

End-user Q&A lives under `help-center/`. The [introduction](help-center/introduction.mdx) links to **topic** pages (for example `help-center/subscriptions.mdx`). Each topic page uses **As a merchant** and **As a buyer** headings and **Card** groups linking to **articles** in `help-center/articles/`.

### Article frontmatter and audience

Every file in `help-center/articles/*.mdx` must declare who it is for so tools (and humans) can group content consistently.

- Add **`audience`** in YAML frontmatter with exactly one value:
  - `audience: merchant` — Polar sellers (dashboard, APIs, configuration).
  - `audience: buyer` — End customers (checkout, customer portal).

- Immediately under the frontmatter, include an **`<Info>`** callout with the same audience in plain language (see existing articles). That keeps the label visible on the published page and duplicates the machine-readable value for anyone scanning the source.

Example:

```yaml
---
title: "How do I …?"
sidebarTitle: "Short sidebar label"
description: "SEO / summary sentence."
audience: buyer
---

<Info>
**Audience:** Buyer — end customers using checkout or the customer portal.
</Info>

Body content starts here.
```

When adding an article: create the MDX file, set `audience`, add the matching `<Info>` block, link it from the right topic page under the correct heading, and register the page path in `docs.json` under the Help Center tab (see the **Topics** group and the per-topic article groups).
