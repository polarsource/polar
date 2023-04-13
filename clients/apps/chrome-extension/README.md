## Install the Chrome extension in developer mode

See https://developer.chrome.com/docs/extensions/mv3/getstarted/development-basics/#load-unpacked

Choose the apps/chrome-extension/extension folder.

Go to a GitHub issue to verify the extension adds a badge to it.

## Getting Started

First, run the development server (probably not needed):

```bash
pnpm dev
```

## Build

```bash
pnpm build
```

Update `extension/manifest.json` to refer to all chunks in `extension/next/static/chunks` (a build step is needed here).

Reload the extension in chrome.

## TODO

- Build step for content script (perhaps separate webpack config generating only one bundle without a hash?)
- We can't rely on loading the next main entrypoint, it requires a `<div id="__next">` to be present on the page, which there of course won't be. But without it, the content entrypoint won't run correctly.
- Components in the content script should probably have inline styles, and can't refer to images loaded off the next server (because there won't be one).
