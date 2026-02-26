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
│   └── checkout/               # Checkout package
```

## Design System

### Colors (oklch)

```css
/* Primary blues */
blue-500   /* Primary actions, links */
blue-600   /* Hover states */

/* Grays for light mode */
gray-50    /* Subtle backgrounds */
gray-100   /* Card backgrounds */
gray-200   /* Borders */
gray-400   /* Secondary text */
gray-500   /* Muted text */
gray-900   /* Primary text */

/* Polar colors for dark mode */
polar-700  /* Card backgrounds */
polar-800  /* Page backgrounds */
polar-900  /* Deeper backgrounds */
polar-950  /* Darkest */
```

### Dark Mode Pattern

Always provide dark mode variants using the `dark:` prefix:

```tsx
<div className="dark:bg-polar-800 bg-white text-gray-900 dark:text-gray-200">
  <p className="dark:text-polar-400 text-gray-500">Muted text</p>
</div>
```

### Border Radius

```css
rounded-lg     /* 8px - Small elements */
rounded-xl     /* 12px - Buttons, cards (default) */
rounded-2xl    /* 16px - Large cards */
rounded-4xl    /* 32px - Hero sections */
```

### Shadows

```css
shadow-md   /* Standard elevation */
shadow-lg   /* Elevated cards */
shadow-xl   /* Modals, popovers */
shadow-3xl  /* Hero elements */
```

## Component Patterns

### Using CVA for Variants

```tsx
import { cva } from 'class-variance-authority'
import { twMerge } from 'tailwind-merge'

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-xl text-sm font-medium',
  {
    variants: {
      variant: {
        default: 'bg-blue-500 text-white hover:bg-blue-600',
        secondary:
          'bg-gray-100 dark:bg-polar-700 text-gray-900 dark:text-white',
        outline: 'border border-gray-200 dark:border-polar-700 bg-transparent',
        ghost: 'hover:bg-gray-100 dark:hover:bg-polar-700',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-12 px-5',
        icon: 'h-8 w-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

const Button = ({ className, variant, size, ...props }) => (
  <button
    className={twMerge(buttonVariants({ variant, size }), className)}
    {...props}
  />
)
```

### Card Pattern

```tsx
<div className="dark:border-polar-700 dark:bg-polar-800 rounded-xl border border-gray-200 bg-white p-4">
  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Title</h3>
  <p className="dark:text-polar-400 text-gray-500">Description</p>
</div>
```

### ShadowBox Pattern

```tsx
import { ShadowBox } from '@polar-sh/ui'
;<ShadowBox>{/* Content with consistent card styling */}</ShadowBox>
```

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

## Imports from @polar-sh/ui

```tsx
// Atoms
import Button from '@polar-sh/ui/components/atoms/Button'
import { Input } from '@polar-sh/ui/components/atoms/Input'
import {
  Card,
  CardHeader,
  CardContent,
} from '@polar-sh/ui/components/atoms/Card'
import { ShadowBox } from '@polar-sh/ui/components/atoms/ShadowBox'
import { Avatar } from '@polar-sh/ui/components/atoms/Avatar'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@polar-sh/ui/components/atoms/Tabs'

// Molecules
import { Banner } from '@polar-sh/ui/components/molecules/Banner'

// Utils
import { cn } from '@polar-sh/ui/lib/utils' // className merger
```

## Common Patterns

### Loading States

```tsx
if (isLoading) {
  return (
    <div className="dark:bg-polar-700 h-32 animate-pulse rounded-xl bg-gray-100" />
  )
}
```

### Empty States

```tsx
if (!data?.length) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <p className="dark:text-polar-400 text-gray-500">No items found</p>
      <Button variant="secondary" className="mt-4">
        Create First Item
      </Button>
    </div>
  )
}
```

### Error Handling

```tsx
if (error) {
  return (
    <div className="rounded-xl bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
      {error.message}
    </div>
  )
}
```

## Reference Files

- Button component: `packages/ui/src/components/atoms/Button.tsx`
- Card component: `packages/ui/src/components/atoms/Card.tsx`
- Global styles: `apps/web/src/styles/globals.css`
- Dashboard layout: `apps/web/src/app/(main)/dashboard/`
