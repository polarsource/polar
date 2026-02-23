# shift

Design token processing CLI for DTCG-aligned YAML token files. Built with [Effect](https://effect.website/).

## Features

- **DTCG-compatible** — tokens use `$value`, `$type`, `$description`
- **Alias resolution** — `{path.to.token}` references with cycle detection
- **Component tokens** — semantic tokens that proxy design tokens via `$themes`
- **Multi-theme output** — per-selector CSS blocks, JSON, and TypeScript exports
- **Three output formats** — CSS custom properties, JSON, TypeScript `as const`

## Install

```bash
pnpm add @polar-sh/shift
```

Or run without installing:

```bash
pnpm dlx @polar-sh/shift build --input "tokens/**/*.yaml"
```

## Quick start

```bash
# Build tokens (colors unchanged, dimensions normalised to px)
shift build --input "tokens/**/*.yaml" --output dist/tokens

# Build with hex colors + dark mode
shift build \
  --input "tokens/**/*.yaml" \
  --output dist/tokens \
  --transform web \
  --themes '{"dark":":root .dark"}'

# Build with OKLCH color space
shift build --input "tokens/**/*.yaml" --output dist/tokens --transform web/oklch

# Validate without writing
shift validate --input "tokens/**/*.yaml"
```

## Token format

Tokens follow the [Design Token Community Group](https://design-tokens.github.io/community-group/format/) (DTCG) spec with `$value`, `$type`, and `$description` keys.

### Design tokens

```yaml
# tokens/colors.yaml
colors:
  $type: color            # inherited by all children
  primary:
    $value: "#0066ff"
    $description: Primary brand color
  secondary:
    $value: "#6b7280"
  text:
    default:
      $value: "#111827"
    muted:
      $value: "#6b7280"

# tokens/spacing.yaml
spacing:
  $type: dimension
  xs: { $value: "4px" }
  sm: { $value: "8px" }
  md: { $value: "16px" }
  base:
    $value: "{spacing.md}"   # alias
```

Supported `$type` values: `color`, `dimension`, `fontFamily`, `fontWeight`, `duration`, `cubicBezier`, `number`, `string`, `shadow`, `gradient`.

### Alias references

Any `$value` written as `{dot.path.to.token}` is resolved at build time. Cycles are detected and reported as errors.

```yaml
accent:
  $value: "{colors.primary}"   # resolves to #0066ff
```

In CSS output, aliases emit `var()` references rather than concrete values — the proxy relationship is preserved at runtime:

```css
:root {
  --colors-primary: #0066ff;
  --accent: var(--colors-primary);  /* proxies --colors-primary */
}
```

### Component tokens

Component tokens extend any token with a `$themes` key that maps theme names to per-theme values (aliases or literals):

```yaml
# tokens/components.yaml
button:
  $type: color
  background:
    $value: "{colors.primary}"          # default: proxies design token
    $description: Button background
    $themes:
      dark: "{colors.secondary}"        # dark: different proxy
      high-contrast: "#000000"          # high-contrast: literal
  text:
    $value: "#ffffff"
    $themes:
      dark: "#f0f0f0"
```

## Output formats

### CSS

```css
:root {
  --colors-primary: #0066ff;
  --button-background: var(--colors-primary);  /* proxy */
}

:root .dark {
  --button-background: var(--colors-secondary);
}
```

### JSON

```json
{
  "colors": { "primary": "#0066ff" },
  "button": { "background": "#0066ff" },
  "$themes": {
    "dark": {
      "button": { "background": "#6b7280" }
    }
  }
}
```

`$themes` is only included when `--themes` is passed and at least one token has theme overrides.

### TypeScript

```ts
export const tokens = {
  colors: { primary: "#0066ff" },
  button: { background: "#0066ff" },
} as const

export const themes = {
  dark: {
    button: { background: "#6b7280" },
  },
} as const
```

`themes` is only exported when `--themes` is passed and at least one token has theme overrides.

## Transform pipelines

`--transform` selects a named pipeline that controls how token values are converted before output.

### Built-in pipelines

| Pipeline | Color output | Dimension output |
|---|---|---|
| `default` | unchanged | `px` suffix added |
| `web` | `#rrggbb` hex | `px` |
| `web/rgb` | `rgb()` / `rgba()` | `px` |
| `web/oklch` | `oklch(L C H)` | `px` |
| `ios` | `#aarrggbb` (ARGB) | `px` |
| `android` | `#aarrggbb` (ARGB) | `px` |

### Built-in value transforms

| Name | Matches | Description |
|---|---|---|
| `color/hex` | `type === 'color'` | Convert to `#rrggbb` hex |
| `color/rgb` | `type === 'color'` | Convert to `rgb()` / `rgba()` |
| `color/hex8rgba` | `type === 'color'` | Convert to `#rrggbbaa` (CSS/PNG order) |
| `color/hex8argb` | `type === 'color'` | Convert to `#aarrggbb` (Android/Windows order) |
| `color/oklch` | `type === 'color'` | Convert to `oklch(L C H)` |
| `dimension/px` | `type === 'dimension'` | Ensure `px` (or other CSS unit) suffix |

All color transforms pass through values they cannot parse — named colors, `var()`, `oklch()`, `color-mix()`, etc. — unchanged.

### Custom pipelines

```ts
import { createDefaultRegistry } from '@polar-sh/shift/transform/built-in'

const registry = createDefaultRegistry()
registry.define('brand', ['color/oklch', 'dimension/px'])
```

## CLI reference

### `shift build`

| Flag | Alias | Default | Description |
|---|---|---|---|
| `--input` | `-i` | `tokens/**/*.yaml` | Glob pattern for YAML token files |
| `--output` | `-o` | `./dist` | Output directory |
| `--format` | `-f` | `css,json,ts` | Comma-separated output formats |
| `--transform` | — | `default` | Named transform pipeline |
| `--themes` | — | — | JSON map of theme name → CSS selector |
| `--watch` | `-w` | `false` | Watch mode (re-builds on file change) |

`--themes` accepts a JSON string:

```bash
--themes '{"dark":":root .dark","high-contrast":":root .high-contrast"}'
```

The keys must match the `$themes` keys used in your token YAML files.

### `shift validate`

| Flag | Alias | Default | Description |
|---|---|---|---|
| `--input` | `-i` | `tokens/**/*.yaml` | Glob pattern for YAML token files |

Parses and resolves all tokens without writing any output. Exits non-zero on error.

## Pipeline

```
YAML files
    │  parse (yaml.ts)
    ▼
TokenGroup tree
    │  resolveAliases (aliases.ts)   ← Kahn's topo sort, cycle detection
    ▼
FlatTokenMap  (aliasOf + themeValues populated)
    │  transformColors / transformDimensions
    ▼
FlatTokenMap  (values normalised)
    │  formatCss / formatJson / formatTypescript
    ▼
Output files
```

## Development

```bash
pnpm build       # compile src/ → dist/
pnpm test        # run vitest (202 tests)
pnpm test:watch  # watch mode
pnpm typecheck   # tsc --noEmit
```
