---
name: add-locale
description: Add a new translation locale to the Polar frontend. Walks through registering the locale, generating translations, wiring the generated file into the i18n package, and updating the public-facing docs. Expects the target locale's ISO 639-1 alpha-2 code (optionally with a BCP-47 region suffix, e.g. `pt-PT`).
user-invocable: true
allowed-tools: Read Edit Write Bash Grep Glob
---

# Add a new translation locale

This skill adds a new locale to the Polar frontend i18n package (`clients/packages/i18n`) and the corresponding public docs. Each step produces its own commit so the PR reads cleanly.

Ask the user for the locale if they haven't provided one. You need:

- `${isoAlpha2}` — the locale code used as the filename and config key (e.g. `ko`, `ja`, `pt-PT`). This is the value appended to `SUPPORTED_LOCALES` verbatim.
- `${localeName}` — the human-readable name used in `LOCALE_NAMES` (e.g. `Korean (South Korea)`, `Japanese`). Follow the style of the existing entries in `clients/packages/i18n/src/config.ts`.

Throughout this doc, `${isoAlpha2}` is substituted literally into filenames, branch names, commit messages, and identifiers.

## Step 1: Sync main

```bash
git checkout main
git pull --ff-only
```

Bail out if the working tree isn't clean — ask the user before stashing or discarding anything.

## Step 2: Create the branch

```bash
git checkout -b add-locale-${isoAlpha2}
```

## Step 3: Register the locale

Edit `clients/packages/i18n/src/config.ts`:

1. Append `'${isoAlpha2}'` to the `SUPPORTED_LOCALES` tuple (keep the `as const`).
2. Add a `${isoAlpha2}: '${localeName}'` entry to `LOCALE_NAMES`. Quote the key if it contains a dash (e.g. `'pt-PT'`).

Commit:

```bash
git add clients/packages/i18n/src/config.ts
git commit -m "Register ${isoAlpha2}"
```

## Step 4: Generate the translation file

```bash
cd clients/packages/i18n
pnpm translate
```

This produces `clients/packages/i18n/src/locales/${isoAlpha2}.ts`. Confirm the file exists and has content before committing.

```bash
git add clients/packages/i18n/src/locales/${isoAlpha2}.ts
git commit -m "Generate ${isoAlpha2}"
```

## Step 5: Wire the locale into the i18n entrypoint

Edit `clients/packages/i18n/src/index.ts`:

1. Add an import near the other locale imports:
   ```ts
   import ${importName} from './locales/${isoAlpha2}'
   ```
   For plain alpha-2 codes use the code itself (`import ko from './locales/ko'`). For hyphenated codes drop the dash and camelCase it to keep a valid identifier (`import ptPT from './locales/pt-PT'`).
2. Add the locale to the `translations` `LocalesRecord` object. Use the bare key when it's a valid identifier (`ko,`) or a quoted key when it's hyphenated (`'pt-PT': ptPT,`).

Commit:

```bash
git add clients/packages/i18n/src/index.ts
git commit -m "Enable ${isoAlpha2}"
```

## Step 6: Update the public docs

Edit `docs/features/checkout/localization.mdx`:

- Add `- ${localeName} (${isoAlpha2})` to the "Supported languages" list.
- Remove the locale from the "coming soon" list if it was listed there.

Commit:

```bash
git add docs/features/checkout/localization.mdx
git commit -m "Update localization docs"
```

## Step 7: Hand back to the user

Summarize the four commits created on `add-locale-${isoAlpha2}` and leave the branch for the user to push and open a PR. Do not push or open a PR unless asked.
