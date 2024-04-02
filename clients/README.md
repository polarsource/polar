# Polar Clients

## What's inside?

This [Turborepo](https://turbo.build/) includes the following packages/apps:

### Apps and Packages

- `apps/web`: [polar.sh](https://polar.sh) – [Next.js](https://nextjs.org/) app
- `packages/polarkit`: Shared resources
- `packages/sdk`: API types

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

### Develop web

```bash
pnpm dev-web
```

### Generate API definitions

```bash
pnpm generate
```

**Adding a new API class?**
You might need to manually add the generated model to `src/client/PolarAPI.ts` in the SDK package.

### Designing with Storybook

Polar uses [Storybook](https://storybook.js.org) to easier work with web components and their design.

To run the Storybook locally:

```bash
# from the "clients" directory
pnpm install
pnpm storybook
```

The storybook should start and run on [http://localhost:6006/](http://localhost:6006/).
