# Frontend Development Guide

Next.js web application with TypeScript, TanStack Query, and Tailwind CSS.

## Quick Commands

```bash
pnpm dev          # Start dev server (http://127.0.0.1:3000)
pnpm build        # Production build
pnpm lint         # Run linting
pnpm test         # Run tests
pnpm generate     # Generate API client from OpenAPI
pnpm typecheck    # Type checking (in apps/web)
```

## Post-Feature Checklist

After finishing a feature, always run `pnpm lint` and check for any new errors or warnings introduced by your changes. Fix them before considering the feature complete.

## File Size Limit

Files are limited to 250 lines of code (excluding blanks and comments) via the `max-lines` ESLint rule. If you hit this limit, refactor the file into smaller pieces — extract sub-components, split hooks into separate files, or move helpers into their own modules. Do not add `eslint-disable max-lines` to new files.

## Project Structure

```
clients/
├── apps/
│   ├── web/                    # Main Next.js application
│   │   └── src/
│   │       ├── app/            # App Router pages
│   │       │   ├── (main)/     # Main layout (dashboard, org pages)
│   │       │   └── (public)/   # Public pages
│   │       └── hooks/          # React hooks
│   ├── app/                    # iOS and Android app (Expo/React Native)
│   └── orbit/                  # Orbit design system documentation and showcase
├── packages/
│   ├── ui/                     # Shared UI components
│   │   └── src/components/
│   │       ├── atoms/          # Basic components (Button, Input, Card)
│   │       ├── molecules/      # Composite components (Banner)
│   │       └── ui/             # shadcn/ui base components
│   ├── client/                 # Generated API client
│   ├── sdk/                    # Published SDK
│   ├── checkout/               # Checkout package
│   └── orbit/                  # Polar's design system containing components, design tokens, etc.
```

## UI Authoring Rule (READ FIRST)

**All new UI must be authored with `<Box />` from `@polar-sh/orbit/Box`.**

`<div>` + Tailwind classes is **deprecated** for layout, spacing, color, borders, radius,
shadow, flex, grid, position, and other visual concerns. Box is a polymorphic, fully
type-safe primitive that consumes Orbit design tokens as first-class props — there is no
className guesswork, no light/dark mode boilerplate (tokens resolve automatically), and no
arbitrary values for things the design system already defines.

**Strict rules going forward:**

- New components: write Box. No `<div>` for visual containers.
- Touching an existing tailwind component: prefer migrating it to Box in the same change
  rather than adding more tailwind on top.
- Never use raw color hex/oklch, raw px spacing, or `dark:` variants — use the tokens.
- Never reach for `className` on Box for properties that have a typed Box prop (padding,
  background, radius, etc.). The typed prop wins.
- Use `<Text />` from `@polar-sh/orbit` for typography rather than tailwind text classes.
- Tailwind is only acceptable for: third-party component overrides where a className is the
  only API, one-off animations not yet expressible via Orbit, or temporary glue while
  migrating a legacy file.

## The `<Box />` Component

Box is the canonical layout/style primitive. It compiles your typed props into StyleX
styles + scoped CSS at build time. Tokens use the CSS `light-dark()` function to
auto-swap between light and dark mode, so you author one styling pass and dark mode
is free.

### `display` defaults to `flex`

Box defaults to `display: flex` for block-level elements (~90% of usage is flex), so a
bare `<Box>` is a flex row. Set `flexDirection`, `gap`, etc. directly without repeating
`display="flex"`. Inline elements (`as="span"`, `as="label"`) and `as="li"` keep their
native display so semantics aren't broken. Pass an explicit `display` (e.g.
`display="block"`, `display="grid"`) to override.

```tsx
<Box flexDirection="column" gap="m">…</Box>   // already flex
<Box display="block">…</Box>                    // opt out of flex
```

### Importing

```tsx
import { Box } from '@polar-sh/orbit/Box'
```

`Box` is exposed as a deep import (`@polar-sh/orbit/Box`), not from the package root.

### Polymorphism via `as`

Box defaults to a `<div>`, but the underlying element is selectable for semantics &
accessibility. Allowed values:

```ts
;'div' |
  'span' |
  'section' |
  'article' |
  'aside' |
  'main' |
  'nav' |
  'header' |
  'footer' |
  'form' |
  'fieldset' |
  'label' |
  'ul' |
  'ol' |
  'li'
```

```tsx
<Box as="section" padding="xl">…</Box>
<Box as="ul" flexDirection="column" rowGap="s">
  <Box as="li">Item</Box>
</Box>
<Box as="nav" alignItems="center" columnGap="m">…</Box>
```

DOM props for the chosen element are typed and forwarded (e.g. `onClick`, `htmlFor` on
`label`, `action` on `form`).

### Design Tokens

Tokens are split across two tiers: `packages/orbit/src/tokens/value.stylex.ts` defines
primitive values (literal colors, sizes), and `packages/orbit/src/tokens/semantics.stylex.ts`
defines semantic tokens (background-primary, text-secondary, etc.) that reference them.
Box accepts token **names**, not raw values.

**Spacing** (`SpacingToken`) — used for padding, margin, gap:

| Token  | Value |
| ------ | ----- |
| `none` | 0     |
| `xs`   | 4px   |
| `s`    | 8px   |
| `m`    | 12px  |
| `l`    | 16px  |
| `xl`   | 24px  |
| `2xl`  | 32px  |
| `3xl`  | 48px  |
| `4xl`  | 64px  |
| `5xl`  | 96px  |

**Colors** (`ColorToken`) — used for `backgroundColor`, `color`, `borderColor`. Each token
auto-resolves light vs dark.

| Token                  | Use                           |
| ---------------------- | ----------------------------- |
| `background-primary`   | Page background               |
| `background-secondary` | Sectioned/raised surface      |
| `background-card`      | Card / inset panel surface    |
| `background-warning`   | Warning surface               |
| `background-success`   | Success surface               |
| `background-danger`    | Danger surface                |
| `text-primary`         | Primary copy                  |
| `text-secondary`       | De-emphasised copy            |
| `text-tertiary`        | Hints, captions, placeholders |
| `text-success`         | Success text                  |
| `text-danger`          | Danger text                   |
| `text-warning`         | Warning text                  |
| `border-primary`       | Default borders & dividers    |
| `border-secondary`     | Subtle/secondary dividers     |
| `border-warning`       | Warning borders               |

**Border radius** (`BorderRadiusToken`): `none`, `s` (8), `m` (12), `l` (16), `xl` (32),
`full` (9999).

**Shadow** (`ShadowToken`): `none`, `s`, `m`, `l`, `xl`.

**Motion** — durations (`DurationToken`) and easings (`EasingToken`) for transitions:

| Duration  | Value | Easing       | Curve                      |
| --------- | ----- | ------------ | -------------------------- |
| `instant` | 0ms   | `standard`   | general-purpose, symmetric |
| `fast`    | 120ms | `decelerate` | enter (fast → settle)      |
| `base`    | 200ms | `accelerate` | exit (settle → fast)       |
| `slow`    | 320ms | `spring`     | slight overshoot           |
| `slower`  | 480ms |              |                            |

Durations are CSS variables, so motion can be globally tuned (or zeroed for reduced
motion). Easings are compile-time constants.

**Breakpoints** (`BreakpointKey`): `sm` (640), `md` (768), `lg` (1024), `xl` (1280). Used
as keys in responsive prop objects (see below).

### Prop Reference

Every prop accepts a single token/value or a responsive object (see "Responsive &
pseudo-states" below).

**Spacing** (token-based; aliases listed in parens):

```
padding (p), paddingTop (pt), paddingRight (pr), paddingBottom (pb), paddingLeft (pl),
paddingHorizontal (px), paddingVertical (py)
margin  (m), marginTop  (mt), marginRight  (mr), marginBottom  (mb), marginLeft  (ml),
marginHorizontal  (mx), marginVertical  (my)   // margin tokens also accept 'auto'
gap (g), rowGap, columnGap
```

**Color** (token-based): `backgroundColor`, `color`, `borderColor`.

**Border**:

```
borderRadius, borderTopLeftRadius, borderTopRightRadius,
borderBottomLeftRadius, borderBottomRightRadius                  // BorderRadiusToken
borderWidth, borderTopWidth, borderRightWidth,
borderBottomWidth, borderLeftWidth                                // number (px)
borderStyle: 'solid' | 'dashed' | 'dotted' | 'none'
```

**Shadow**: `boxShadow` — ShadowToken.

**Layout**:

```
display: 'flex' | 'grid' | 'block' | 'inline' | 'inline-flex' | 'inline-block' | 'none' | 'contents'
         // defaults to 'flex' for block-level elements (see "display defaults to flex" above)
overflow / overflowX / overflowY: 'hidden' | 'auto' | 'scroll' | 'visible'
width, height, minWidth, maxWidth, minHeight, maxHeight: string | number   // numbers → px
aspectRatio: string                                                         // '16 / 9'
```

**Flex**:

```
flex, flexDirection ('row'|'column'|'row-reverse'|'column-reverse'),
flexWrap ('wrap'|'nowrap'|'wrap-reverse'),
flexGrow, flexShrink, flexBasis,
alignItems / alignSelf  ('start'|'end'|'center'|'baseline'|'stretch'  [+ 'auto' on alignSelf]),
justifyContent ('start'|'end'|'center'|'between'|'around'|'evenly'),
alignContent   ('start'|'end'|'center'|'between'|'around'|'evenly'|'stretch')
```

**Grid**:

```
gridTemplateColumns, gridTemplateRows, gridColumn, gridRow,
gridAutoFlow ('row'|'column'|'dense'|'row-dense'|'column-dense'),
gridAutoColumns, gridAutoRows
```

**Position**:

```
position: 'relative'|'absolute'|'fixed'|'sticky'|'static'
top, right, bottom, left, inset: string | number
zIndex: number | string
```

**Motion** (transitions; pair with pseudo-state props to animate hover/focus/active):

```
transitionProperty: 'none'|'all'|'common'|'colors'|'opacity'|'shadow'|'transform'
transitionDuration: DurationToken                     // 'instant'|'fast'|'base'|'slow'|'slower'
transitionTimingFunction (alias: ease): EasingToken   // 'standard'|'decelerate'|'accelerate'|'spring'
transitionDelay: DurationToken
transform: string                                      // e.g. 'translateY(-2px)', 'scale(1.02)'
transformOrigin: string
willChange: string
```

`transitionProperty` keywords expand to real property lists — `colors` → color +
background-color + border-color, `common` → colors + box-shadow + opacity + transform.
Without `transitionProperty`, `transitionDuration` applies to `all`.

**Visual**:

```
opacity: number
cursor: 'pointer'|'default'|'not-allowed'|'grab'|'grabbing'|'text'|'move'|'wait'
pointerEvents: 'none'|'auto'
visibility: 'visible'|'hidden'
userSelect: 'none'|'text'|'all'|'auto'
textAlign: 'left'|'center'|'right'|'justify'
```

### Responsive & Pseudo-state Values

Any style prop accepts an object keyed by `base` (mobile-first default), the breakpoint
keys (`sm`/`md`/`lg`/`xl`), and the pseudo-state keys (`hover`, `focus`, `active`,
`focusVisible`, `focusWithin`):

```tsx
<Box
  flexDirection={{ base: 'column', md: 'row' }}
  padding={{ base: 'l', lg: '2xl' }}
  gridTemplateColumns={{
    base: '1fr',
    md: 'repeat(2, 1fr)',
    xl: 'repeat(4, 1fr)',
  }}
  backgroundColor={{ base: 'background-card', hover: 'background-secondary' }}
  cursor={{ hover: 'pointer' }}
/>
```

Mix freely — `base` is the unconditional value, breakpoint keys are min-width media
queries, pseudo-state keys generate scoped pseudo-class rules.

### Common Recipes

**Vertical stack**:

```tsx
<Box flexDirection="column" rowGap="l">
  …
</Box>
```

**Horizontal row, centered, with gap**:

```tsx
<Box alignItems="center" columnGap="m">
  …
</Box>
```

**Card surface**:

```tsx
<Box
  borderRadius="l"
  backgroundColor="background-card"
  borderWidth={1}
  borderStyle="solid"
  borderColor="border-primary"
  padding="xl"
  flexDirection="column"
  rowGap="m"
>
  <Text variant="heading-xs" as="h3">
    Title
  </Text>
  <Text color="muted">Description</Text>
</Box>
```

**Interactive card (smooth hover)** — pseudo-state props animate instead of snapping when
you add a transition:

```tsx
<Box
  borderRadius="l"
  backgroundColor={{ base: 'background-card', hover: 'background-secondary' }}
  boxShadow={{ base: 's', hover: 'm' }}
  transform={{ hover: 'translateY(-2px)' }}
  transitionProperty="common"
  transitionDuration="fast"
  ease="decelerate"
  cursor={{ hover: 'pointer' }}
  padding="xl"
>
  …
</Box>
```

**Responsive grid** — prefer the `Grid` primitive (see below); it defaults to
`display: grid` and uses short prop names:

```tsx
<Grid
  templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' }}
  gap="l"
>
  {items.map((item) => (
    <Card key={item.id} {...item} />
  ))}
</Grid>
```

**Sticky toolbar**:

```tsx
<Box
  position="sticky"
  top={0}
  zIndex={10}
  backgroundColor="background-primary"
  borderBottomWidth={1}
  borderStyle="solid"
  borderColor="border-primary"
  paddingHorizontal="xl"
  paddingVertical="m"
  alignItems="center"
  justifyContent="between"
>
  …
</Box>
```

**Loading skeleton**:

```tsx
<Box
  height={128}
  borderRadius="m"
  backgroundColor="background-card"
  className="animate-pulse"
/>
```

**Empty state**:

```tsx
<Box
  flexDirection="column"
  alignItems="center"
  justifyContent="center"
  paddingVertical="3xl"
  rowGap="l"
>
  <Text color="muted">No items found</Text>
  <Button variant="secondary">Create First Item</Button>
</Box>
```

**Error surface**:

```tsx
<Box
  borderRadius="m"
  backgroundColor="background-warning"
  borderWidth={1}
  borderStyle="solid"
  borderColor="border-warning"
  padding="l"
>
  <Text>{error.message}</Text>
</Box>
```

### `className` and `style` (escape hatches)

Box accepts `className` and `style` for things outside the design system (animation
keyframes, third-party utility classes, CSS Grid template areas, etc.). Don't use them to
re-implement what a typed prop already covers — that's the failure mode this primitive is
designed to prevent. If you find yourself reaching for `className="bg-…"` or
`className="p-…"`, you're using Box wrong.

### When the typed prop doesn't exist

Open `clients/packages/orbit/src/utils/types.ts` to confirm — most needs are covered. If a
genuinely missing CSS property comes up, prefer extending `BoxStyleProps` (with token
support where applicable) over a tailwind escape hatch. Flag this on the PR.

### `Grid`

`Grid` is a `Box` preset for CSS grid. It defaults to `display: grid` and re-exposes the
grid properties under short, Chakra-style prop names; every other Box prop (`gap`,
`padding`, color, responsive objects, …) is inherited.

```tsx
import { Grid } from '@polar-sh/orbit'

<Grid templateColumns="repeat(3, 1fr)" gap="m">
  …
</Grid>

// areas + responsive
<Grid
  templateAreas={{ base: '"head" "main"', md: '"head head" "nav main"' }}
  templateColumns={{ base: '1fr', md: '200px 1fr' }}
  gap="l"
/>
```

Prop names: `templateColumns`, `templateRows`, `templateAreas`, `autoFlow`, `autoRows`,
`autoColumns`, `column`, `row`, and `inline` (renders `inline-grid`).

Use `GridItem` for children that need to span or be placed explicitly:

```tsx
import { Grid, GridItem } from '@polar-sh/orbit'
;<Grid templateColumns="repeat(4, 1fr)" gap="m">
  <GridItem colSpan={2}>Spans two columns</GridItem>
  <GridItem colStart={3} colEnd={5} rowSpan={2}>
    Placed explicitly
  </GridItem>
  <GridItem area="sidebar">By template area</GridItem>
</Grid>
```

`GridItem` props: `colSpan`/`rowSpan` (number or `"auto"`), `colStart`/`colEnd`/`rowStart`/
`rowEnd`, and `area` — all responsive. Plus every Box prop.

### Other Orbit primitives

Use these instead of hand-rolled tailwind components:

```tsx
import { Text } from '@polar-sh/orbit' // typography (variant-driven)
import { Button, Grid } from '@polar-sh/orbit'
import { Avatar, SegmentedControl } from '@polar-sh/orbit'
import { Alert } from '@polar-sh/orbit' // tinted callout (info/warning/danger/success)
import { ButtonGroup } from '@polar-sh/orbit' // one or two primary/ghost actions
```

`Alert` takes a `variant` (`info` | `warning` | `danger` | `success`, default `info`), a
`title`, and an optional `description`; the variant abstracts away the icon and all colors.
It also accepts `loading` (swaps the icon for a spinner), `onDismiss` (renders a dismiss
button), and `actions` (one or two `ButtonGroup` CTAs, rendered bottom-right). `ButtonGroup`
takes an `actions` tuple of at most two `{ text, onClick, loading?, disabled? }` — the first
renders as the primary button, the second as a ghost button.

Prefer `Box` when you need full control; prefer the named primitive when one exists for
your use case (Text for any text node, Button for actions, Grid for grid layouts).

## Legacy Tailwind (deprecated)

These patterns exist throughout the codebase but **must not be used in new code**:

- `<div className="…">` for layout/spacing/color
- `dark:` variants — Orbit color tokens auto-resolve
- Hard-coded color names like `bg-blue-500`, `text-gray-500`, `dark:bg-polar-800`
- `rounded-xl`, `shadow-lg`, `p-4`, `gap-2` etc. — use Box props with tokens

When editing a legacy file, migrate the file (or the immediate component) to Box rather
than expanding the tailwind surface area.

## Data Fetching with TanStack Query

### Query Pattern

```tsx
import { useQuery } from '@tanstack/react-query'
import { api } from '@/utils/api'

const useProducts = (organizationId: string) => {
  return useQuery({
    queryKey: ['products', organizationId],
    queryFn: () => api.products.list({ organizationId }),
    enabled: !!organizationId,
  })
}

// In component
const { data: products, isLoading, error } = useProducts(orgId)
```

### Mutation Pattern

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query'

const useCreateProduct = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: ProductCreate) => api.products.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}
```

## State Management with Zustand

```tsx
import { create } from 'zustand'

interface AppState {
  sidebarOpen: boolean
  toggleSidebar: () => void
}

const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}))
```

## Form Handling

```tsx
import { useForm } from 'react-hook-form'

const MyForm = () => {
  const form = useForm({
    defaultValues: { name: '', email: '' },
  })

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Input {...form.register('name')} />
      {form.formState.errors.name && (
        <span className="text-sm text-red-500">
          {form.formState.errors.name.message}
        </span>
      )}
    </form>
  )
}
```

## Imports

```tsx
// Orbit (preferred — design-system primitives)
import { Box } from '@polar-sh/orbit/Box'
import { Text, Button, Avatar, SegmentedControl } from '@polar-sh/orbit'
import { DataTable, Select } from '@polar-sh/orbit'

// Legacy @polar-sh/ui (use only when an Orbit equivalent doesn't exist)
import { Card } from '@polar-sh/ui/components/atoms/Card'
import { Banner } from '@polar-sh/ui/components/molecules/Banner'
```

## Common Patterns

### Loading States

```tsx
if (isLoading) {
  return (
    <Box
      height={128}
      borderRadius="m"
      backgroundColor="background-card"
      className="animate-pulse"
    />
  )
}
```

### Empty States

```tsx
if (!data?.length) {
  return (
    <Box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      paddingVertical="3xl"
      rowGap="l"
      textAlign="center"
    >
      <Text color="muted">No items found</Text>
      <Button variant="secondary">Create First Item</Button>
    </Box>
  )
}
```

### Error Handling

```tsx
if (error) {
  return (
    <Box
      borderRadius="m"
      backgroundColor="background-warning"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-warning"
      padding="l"
    >
      <Text>{error.message}</Text>
    </Box>
  )
}
```

## Internationalization (i18n)

Translation files live in `packages/i18n/src/locales/`. When adding new translatable strings, **only add them to `en.ts`**. Do not manually edit other locale files. A CI job automatically translates new English strings into all supported languages and commits the results to the branch. After pushing changes to `en.ts`, pull the branch once the CI translation job completes.

## Reference Files

- Box component: `packages/orbit/src/components/Box.tsx`
- Box prop types: `packages/orbit/src/utils/types.ts`
- Design tokens (spacing, color, radius, shadow, breakpoints): `packages/orbit/src/tokens/value.stylex.ts` (primitives) and `packages/orbit/src/tokens/semantics.stylex.ts` (semantic colors)
- Orbit barrel exports: `packages/orbit/src/index.ts`
- Legacy Card: `packages/ui/src/components/atoms/Card.tsx`
- Global styles: `apps/web/src/styles/globals.css`
- Dashboard layout: `apps/web/src/app/(main)/dashboard/`
