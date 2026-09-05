# Adapter bundle size report

Measured on 2026-09-05, before and after migrating to standalone SDK functions. Baseline commit: `02758b53b425e35500b2c939367a33b1425b03cc`. All sizes are KiB (1,024 bytes). Negative changes indicate reductions.

| Adapter / entry point         | Before minified | After minified | Change | Before gzip | After gzip | Change |
| ----------------------------- | --------------: | -------------: | -----: | ----------: | ---------: | -----: |
| adapter-utils                 |            4.32 |           4.32 |   0.0% |        0.91 |       0.91 |   0.0% |
| Better Auth, including client |          111.34 |          65.47 | -41.2% |       19.64 |      14.45 | -26.4% |
| Next.js                       |           76.24 |          13.77 | -81.9% |       10.66 |       4.23 | -60.3% |
| Nuxt runtime                  |           75.56 |          13.12 | -82.6% |       10.60 |       4.16 | -60.8% |
| TanStack Start                |           75.86 |          13.43 | -82.3% |       10.56 |       4.14 | -60.8% |

## Additional entry points

| Adapter / entry point                       | Before minified | After minified | Change | Before gzip | After gzip | Change |
| ------------------------------------------- | --------------: | -------------: | -----: | ----------: | ---------: | -----: |
| Better Auth exports, caller client excluded |           57.37 |          62.88 |   9.6% |       12.75 |      13.46 |   5.5% |
| Better Auth browser client                  |            4.21 |           4.21 |   0.0% |        1.71 |       1.71 |   0.0% |
| Nuxt module registration                    |            0.25 |           0.25 |   0.0% |        0.20 |       0.20 |   0.0% |

Better Auth receives its SDK client from the caller. Its primary measurement re-exports the complete adapter and constructs/exports the caller client: `createPolar` before, `createPolarCore` after. The adapter-only measurement excludes that caller client. It grows because the adapter now imports the specific SDK operations itself; the combined footprint drops. Both measurements retain all adapter exports.

Nuxt's registration module does not import the server handlers, so its runtime is measured separately. `adapter-utils` has only SDK type imports and requires no migration. The Better Auth browser entry also requires no migration.

## Measurement method

- SDK `1.0.0-alpha.20` (API version `2026-04`), esbuild `0.27.1`, Node `24.20.0`, unchanged across both measurements. The existing lockfile was used; no dependency versions changed.
- Each source entry is bundled as ESM with minification and tree shaking, targeting Node 22. All exports are retained. Sourcemaps and declaration files are excluded. Gzip uses level 9.
- The Polar SDK, shared adapter utilities, and checkout embed dependency are included. Workspace adapter-utils resolves to its source for both measurements.
- Framework/runtime dependencies are external: Next.js, TanStack, Nuxt, H3, Better Auth, and Zod. These are controlled comparisons of the adapter plus its Polar dependencies, not complete deployed application bundles. A consuming app that uses fewer exports may tree-shake further.
- Normal package builds were also verified. Their emitted files leave package dependencies external, so their file sizes do not represent the SDK code pulled into a consuming application.

The [measurement script](../scripts/measure-adapter-bundles.mjs) writes each minified bundle, esbuild input metafile, and JSON byte counts. [Raw before/after results](./bundle-sizes.json) are retained with this report. Run from `clients/` after installing lockfile dependencies:

```sh
node scripts/measure-adapter-bundles.mjs after /tmp/polar-adapter-bundles createPolarCore
```

To reproduce the baseline, use a separate checkout of the baseline commit with the same lockfile dependencies, copy the measurement script into `clients/scripts/`, and run:

```sh
node scripts/measure-adapter-bundles.mjs before /tmp/polar-adapter-bundles createPolar
```

## Migration

Next.js, Nuxt, and TanStack Start now construct a core client and import only checkout/session operations. Better Auth uses standalone operations for checkout, portal, usage, customer hooks, organization membership, and seats. Webhook validation keeps using the SDK webhook export.

**Better Auth has a breaking client-option change:** replace `createPolar(...)` with `createPolarCore(...)` when constructing its `client`. Custom `use` plugins receive `PolarCore` and must use standalone operations. The README, example, and major-version changeset document this migration. Other adapters keep their public configuration unchanged.

## Validation

- All five package builds and type checks passed.
- `pnpm lint` passed from `clients/`.
- 270 tests passed: adapter-utils 26, Better Auth 209, Next.js 34, Nuxt 1. TanStack Start has no test script.
- New transport tests exercise real SDK functions with mocked HTTP responses: sandbox checkout authentication and redirects, external-customer portal creation, team-customer lookup/creation after a 404, and customer-session token overrides for portal requests. Existing business-logic mocks are bound to standalone operations while preserving their per-client isolation.
