Local cache storage of our OpenAPI schema & updates during generation & build with `pnpm generate && pnpm build`

The cached files are ignored by .gitignore since we only care about revisioning
the actual TS model changes & internal SDK code.
