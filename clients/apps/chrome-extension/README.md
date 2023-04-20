# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Install the extension

Go to chrome://extensions in Chrome. Enable Developer mode in the top-right corner.

Click "Load unpacked" and point to the clients/apps/chrome-extension/extension folder.

## Use the extension

- Click the extension in Chrome's toolbar
- Choose Authorize
- You're taken to a page that reveals an auth token to the extension
- Visit the issues page of a repo you have access to in Polar

## Make changes

Edit some code.

Run

```bash
pnpm build
```

Then press the little reload button on the extension on chrome://extensions.

## TODO

- Uses webpack instead of `react-scripts build` to output `extension/{content,auth,popup}.js` bundles
- Exludes `*.test.ts*` in `tsconfig.json` because `jest-dom` isn't imported at build time, breaking the DOM additions it makes (`.toBeInTheDocument()` etc) in tests
