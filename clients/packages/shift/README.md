# shift

Design token processing CLI for Polar's custom YAML schema.

Shift is intentionally **not DTCG-compliant**. It uses a stricter, flatter schema optimized for Orbit.

## Install

```bash
pnpm add @polar-sh/shift
```

Or run from this monorepo package:

```bash
node clients/packages/shift/bin/shift.js --help
```

## What Shift Does

1. Parses token YAML documents (`props`, `imports`, `global`)
2. Validates token names and schema
3. Resolves aliases (with cycle detection)
4. Evaluates arithmetic expressions in token values
5. Applies a named transform pipeline
6. Emits one or more formatters (`css`, `json`, `ts`, `ts-vars`)

## Token Schema (Current)

Each token file must be a token document with exactly these top-level properties:

- `props`: object of token definitions
- `imports`: array of relative file paths
- `global`: optional object with default `type` and/or `category` for tokens in that file

Example:

```yaml
props:
  COLOR_BG:
    value:
      colorSpace: srgb
      components: [1, 1, 1]
  SPACING_4:
    value: "16px"
imports:
  - "./primitives.yaml"
global:
  category: DESIGN
```

### Important structural rules

- `props` must contain **direct token definitions only**
- Grouped nested definitions under `props` are rejected
- Token keys must match `^[A-Z0-9_]+$`
- Only these token fields are allowed:
  - `value`
  - `type`
  - `category`
  - `description`
  - `themes`
  - `breakpoints`

## Token Value Types

Supported `type` values:

- `color`
- `dimension`
- `fontFamily`
- `fontWeight`
- `duration`
- `cubicBezier`
- `number`
- `string`
- `shadow`
- `gradient`

Supported `value` forms:

- string
- number
- color object
- dimension object

Dimension object:

```yaml
value:
  value: 0.5
  unit: rem
```

Color object supports exactly one of these shapes:

1. Components mode

```yaml
value:
  colorSpace: srgb
  components: [0.467, 0.467, 0.467]
  alpha: 1 # optional
```

2. Hex mode (sRGB inferred)

```yaml
value:
  hex: "#777777"
  alpha: 1 # optional, overrides hex alpha if provided
```

Invalid:

```yaml
value:
  hex: "#777777"
  colorSpace: srgb
  components: [0.467, 0.467, 0.467]
```

## Imports and Merge Behavior

`imports` are resolved relative to the current file.

- Circular imports fail validation
- Imported tokens are merged first
- Local `props` override imported keys on conflict

This allows hoisting + aliasing from shared design-token documents.

## Alias Resolution

Alias syntax uses braces:

```yaml
value: "{COLOR_BG}"
```

Shift canonicalizes alias refs so both notations resolve to the same canonical path:

- `{COLOR_BG}`
- `{COLOR__BG}`

### Path model

Internally, keys are represented as dot paths by splitting `__`:

- `BUTTON__PRIMARY__BACKGROUND` -> `BUTTON.PRIMARY.BACKGROUND`

That same path is used for:

- alias dependency graph
- cycle detection
- `aliasOf` tracking
- CSS var naming (dots converted to hyphens)

### Alias behavior by formatter

- CSS formatter preserves proxy relationships with `var(--target)` when `aliasOf` exists
- JSON/TS formatters emit concrete resolved values
- `ts-vars` always emits `var(--...)` references for every token

## Arithmetic

Shift supports arithmetic expressions in string values, including aliases:

```yaml
BASE:
  type: number
  value: 8
DOUBLE:
  type: number
  value: "{BASE} * 2"
OFFSET:
  type: number
  value: "{DOUBLE} + 4"
```

Dimension arithmetic is supported too:

```yaml
SPACING_BASE:
  type: dimension
  value:
    value: 0.5
    unit: rem
SPACING_DOUBLE:
  type: dimension
  value: "{SPACING_BASE} * 2"
```

### Arithmetic rules

- Operators: `+`, `-`, `*`, `/`, parentheses
- `+` and `-` require same unit on both sides
- `*` requires one side to be unitless (number)
- `/` requires divisor to be unitless and non-zero
- Unknown alias refs fail
- Cycles fail
- Malformed expressions fail

## Themes and Breakpoints

Each token can define context overrides:

```yaml
props:
  BUTTON__BG:
    type: color
    value: "{COLOR_BG}"
    themes:
      dark:
        colorSpace: srgb
        components: [0, 0, 0]
    breakpoints:
      sm: "12px"
```

- `themes` and `breakpoints` values support the same value forms as `value`
- Aliases in theme/breakpoint overrides are resolved
- Their direct alias source is tracked via `aliasOf`

## Transform Pipelines

Use `--transform` to pick a pipeline.

Built-in pipelines:

- `default`: `color/css` + `dimension/px`
- `web`: `color/css` + `color/hex` + `dimension/px`
- `web/rgb`: `color/css` + `color/rgb` + `dimension/px`
- `web/oklch`: `color/css` + `color/oklch` + `dimension/px`
- `ios`: `color/css` + `color/hex8argb` + `dimension/px`
- `android`: `color/css` + `color/hex8argb` + `dimension/px`

Built-in value transforms:

- `color/css`: serialize color values as CSS-like strings
- `color/rgb`: convert parseable colors to `rgb()` / `rgba()`
- `color/hex`: convert parseable colors to `#rrggbb`
- `color/hex8rgba`: convert parseable colors to `#rrggbbaa`
- `color/hex8argb`: convert parseable colors to `#aarrggbb`
- `color/oklch`: convert parseable colors to `oklch(...)`
- `dimension/px`: normalize dimension values to unit strings, defaulting bare numbers to `px`

Notes:

- Color transforms pass through unparseable color strings unchanged
- Transform application preserves token metadata and `aliasOf`

## Formatters

Use `--format` with comma-separated values.

Supported formatter names:

- `css`
- `json`
- `ts` (or `typescript`)
- `ts-vars`

### CSS (`tokens.css`)

- Emits `:root` for defaults
- Emits one block per theme selector (`--themes` map)
- Emits one `@media` block per breakpoint (`--breakpoints` map)
- Emits alias proxies as `var(--...)`

### JSON (`tokens.json`)

- Emits nested object built from token raw paths
- Emits concrete resolved values
- Optionally includes `$themes` and `$breakpoints` objects

### TypeScript (`tokens.ts`)

- Emits `export const tokens = ... as const`
- Emits concrete resolved values
- Optionally exports `themes` and `breakpoints` objects

### TypeScript vars (`vars.ts`)

- Emits `export const tokens = ... as const`
- Every leaf is `var(--TOKEN-PATH)`
- Useful for runtime CSS-variable references in UI code

## CLI

### Build

```bash
node clients/packages/shift/bin/shift.js build \
  --input 'clients/packages/orbit/tokens/**/*.yaml' \
  --output 'clients/packages/orbit/src/tokens' \
  --format 'ts,ts-vars' \
  --transform 'default' \
  --themes '{"dark":":root .dark"}' \
  --breakpoints '{"sm":"(min-width: 640px)"}'
```

Options:

- `--input`, `-i`: glob pattern (default `tokens/**/*.yaml`)
- `--output`, `-o`: output dir (default `./dist`)
- `--format`, `-f`: comma-separated formats (default `css,json,ts`)
- `--transform`: named pipeline (default `default`)
- `--themes`: JSON map theme -> CSS selector
- `--breakpoints`: JSON map breakpoint -> media query condition
- `--watch`, `-w`: accepted by CLI, currently no watch-loop behavior in implementation

### Validate

```bash
node clients/packages/shift/bin/shift.js validate --input 'clients/packages/orbit/tokens/**/*.yaml'
```

Validation performs parse + schema + name checks + alias/arithmetic resolution, then exits without writing files.

## Practical Example

```yaml
# colors.yaml
props:
  COLOR_BG:
    type: color
    value:
      hex: "#ffffff"
imports: []
global:
  category: DESIGN

# button.yaml
props:
  BUTTON__BACKGROUND:
    type: color
    value: "{COLOR_BG}"
  BUTTON__HEIGHT:
    type: dimension
    value: "{SPACING_4} * 2"
imports:
  - "./colors.yaml"
  - "./spacing.yaml"
global:
  category: COMPONENT
```

`BUTTON__BACKGROUND` keeps alias proxy behavior in CSS, while `BUTTON__HEIGHT` is evaluated arithmetically before formatting.

## Development

```bash
pnpm -C clients/packages/shift test
pnpm -C clients/packages/shift typecheck
pnpm -C clients/packages/shift build
```
