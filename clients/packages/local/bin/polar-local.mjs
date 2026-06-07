#!/usr/bin/env -S node --import tsx --disable-warning=ExperimentalWarning
/**
 * Thin CLI: boot the @polar-sh/local sidecar.
 *
 * `--import tsx` (in the shebang) registers the tsx loader so the TypeScript
 * source under `src/` runs directly — no build step. All configuration is via
 * environment variables; see the README. Equivalent to `pnpm start`.
 */
import '../src/main.ts'
