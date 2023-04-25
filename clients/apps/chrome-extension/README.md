# The Polar Chrome Extension

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Anatomy of this project

This project has three different "entry points":

- `popup.html`, which includes `popup.tsx`, is the extensions pop-up, the page that is shown when you click the extension's icon in the Chrome toolbar. Click it directly after you install the extension and go through the 1-click authorization process.
- `auth.ts` is a content script that scrapes Polar's `/settings/extension` URL to look for an auth token
- `index.tsx` is the main content script, that decorates issues in the GitHub issue list

## Build the extension

Before the extension can be installed (and after every change), you need to rebuild it

```bash
pnpm build
```

## Install the extension

Go to chrome://extensions in Chrome. Enable Developer mode in the top-right corner.

Click "Load unpacked" and point to the clients/apps/chrome-extension/extension folder.

## Use the extension

- Click the extension in Chrome's toolbar
- Choose Authorize
- You're taken to a page that reveals an auth token to the extension
- Visit the issues page of a repo you have access to in Polar

## Make changes

Edit some code, then rebuild the project, and press the little reload button on the extension on chrome://extensions.

## TODO

- Uses webpack instead of `react-scripts build` to output `extension/*.js` bundles. Should this be a create-react-app at all?
- Exludes `*.test.ts*` in `tsconfig.json` because `jest-dom` isn't imported at build time, breaking the DOM additions it makes (`.toBeInTheDocument()` etc) in tests
