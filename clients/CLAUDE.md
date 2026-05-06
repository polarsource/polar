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
│   └── web/                    # Main Next.js application
│       └── src/
│           ├── app/            # App Router pages
│           │   ├── (main)/     # Main layout (dashboard, org pages)
│           │   └── (public)/   # Public pages
│           └── hooks/          # React hooks
├── packages/
│   ├── ui/                     # Shared UI components
│   │   └── src/components/
│   │       ├── atoms/          # Basic components (Button, Input, Card)
│   │       ├── molecules/      # Composite components (Banner)
│   │       └── ui/             # shadcn/ui base components
│   ├── client/                 # Generated API client
│   ├── sdk/                    # Published SDK
│   ├── checkout/               # Checkout package
└   └── orbit/                  # Polar's design system containing components, design tokens, etc.
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
styles + scoped CSS at build time. Tokens are CSS variables that auto-swap on
`prefers-color-scheme`, so you author one styling pass and dark mode is free.

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
<Box as="ul" display="flex" flexDirection="column" rowGap="s">
  <Box as="li">Item</Box>
</Box>
<Box as="nav" display="flex" alignItems="center" columnGap="m">…</Box>
```

DOM props for the chosen element are typed and forwarded (e.g. `onClick`, `htmlFor` on
`label`, `action` on `form`).

### Design Tokens

Tokens live in `packages/orbit/src/tokens/tokens.stylex.ts`. Box accepts token **names**,
not raw values.

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
| `background-pending`   | Pending/neutral surface       |
| `text-primary`         | Primary copy                  |
| `text-secondary`       | De-emphasised copy            |
| `text-tertiary`        | Hints, captions, placeholders |
| `text-success`         | Success text                  |
| `text-danger`          | Danger text                   |
| `text-warning`         | Warning text                  |
| `text-pending`         | Pending/neutral text          |
| `border-primary`       | Default borders & dividers    |
| `border-secondary`     | Subtle/secondary dividers     |
| `border-warning`       | Warning borders               |

**Border radius** (`BorderRadiusToken`): `none`, `s` (8), `m` (12), `l` (16), `xl` (32),
`full` (9999).

**Shadow** (`ShadowToken`): `none`, `s`, `m`, `l`, `xl`.

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
  display="flex"
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
<Box display="flex" flexDirection="column" rowGap="l">
  …
</Box>
```

**Horizontal row, centered, with gap**:

```tsx
<Box display="flex" alignItems="center" columnGap="m">
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
  display="flex"
  flexDirection="column"
  rowGap="m"
>
  <Text variant="heading-xs" as="h3">
    Title
  </Text>
  <Text color="muted">Description</Text>
</Box>
```

**Responsive grid**:

```tsx
<Box
  display="grid"
  gridTemplateColumns={{
    base: '1fr',
    md: 'repeat(2, 1fr)',
    xl: 'repeat(4, 1fr)',
  }}
  gap="l"
>
  {items.map((item) => (
    <Card key={item.id} {...item} />
  ))}
</Box>
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
  display="flex"
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
  display="flex"
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

### Other Orbit primitives

Use these instead of hand-rolled tailwind components:

```tsx
import { Text } from '@polar-sh/orbit' // typography (variant-driven)
import { Stack } from '@polar-sh/orbit' // shorthand for flex stacks (when Box is overkill)
import { Card, CardHeader, CardContent, CardFooter } from '@polar-sh/orbit'
import { Button } from '@polar-sh/orbit'
import {
  Status,
  Avatar,
  Input,
  SegmentedControl,
  DataTable,
} from '@polar-sh/orbit'
```

Prefer `Box` when you need full control; prefer the named primitive when one exists for
your use case (Card for card chrome, Text for any text node, Button for actions).

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
import {
  Text,
  Button,
  Stack,
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  Avatar,
  Input,
  Status,
  SegmentedControl,
  DataTable,
} from '@polar-sh/orbit'

// Legacy @polar-sh/ui (use only when an Orbit equivalent doesn't exist)
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@polar-sh/ui/components/atoms/Tabs'
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
      display="flex"
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
- Design tokens (spacing, color, radius, shadow, breakpoints): `packages/orbit/src/tokens/tokens.stylex.ts`
- Orbit barrel exports: `packages/orbit/src/index.ts`
- Legacy Button: `packages/ui/src/components/atoms/Button.tsx`
- Legacy Card: `packages/ui/src/components/atoms/Card.tsx`
- Global styles: `apps/web/src/styles/globals.css`
- Dashboard layout: `apps/web/src/app/(main)/dashboard/`
