# Polar Clients

## What's inside?

This [Turborepo](https://turbo.build/) includes the following packages/apps:

### Apps and Packages

- `apps/web`: [polar.sh](https://polar.sh) – [Next.js](https://nextjs.org/) app
- `apps/chrome-extension`: Polar Chrome Extension, built with webpack
- `packages/polarkit`: Shared resources

Each package/app is 100% [TypeScript](https://www.typescriptlang.org/).

### Install

```bash
pnpm install
```

### Build

To build all apps and packages, run the following command:

```bash
pnpm build
```

### Develop

```bash
pnpm dev
```

### Designing with Storybook

Polar uses [Storybook](https://storybook.js.org) to easier work with web components and their design.

To run the Storybook locally:

```bash
# from the "clients" directory
pnpm install
pnpm storybook
```

The storybook should start and run on [http://localhost:6006/](http://localhost:6006/).
