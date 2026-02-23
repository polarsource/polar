import React, { type ElementType } from 'react'
import { twMerge } from 'tailwind-merge'
import type {
  BoxProps,
  Breakpoint,
  FlexContainerProps,
} from '../primitives/createBox'
import { resolveContainerClasses } from '../primitives/resolveProperties'
import { type OrbitTheme } from '../tokens/theme'
import { Box } from './Box'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Any breakpoint except 'default', used to specify a layout switch point. */
export type StackBreakpoint = Exclude<Breakpoint, 'default'>

/**
 * Container props exposed directly on Stack.
 * display is omitted — Stack is always `flex`.
 * flexDirection is omitted — use vertical / horizontal / verticalUntil / horizontalUntil.
 */
type StackContainerProps = Omit<
  FlexContainerProps,
  'display' | 'flexDirection'
>

export type StackProps<E extends ElementType = 'div'> = BoxProps<
  OrbitTheme,
  E
> &
  StackContainerProps & {
    /**
     * Render children in a row (horizontal flex). This is the default.
     * Useful when combining with horizontalUntil to be explicit.
     */
    horizontal?: boolean
    /**
     * Render children in a column (vertical flex). Equivalent to flex-col.
     *
     * @example
     * <Stack vertical gap="spacing-2">…</Stack>
     */
    vertical?: boolean
    /**
     * Stack vertically (column) until this breakpoint, then switch to
     * horizontal (row).
     *
     * @example
     * <Stack verticalUntil="xl">…</Stack>
     * // → flex flex-col xl:flex-row
     */
    verticalUntil?: StackBreakpoint
    /**
     * Stack horizontally (row) until this breakpoint, then switch to
     * vertical (column).
     *
     * @example
     * <Stack horizontalUntil="lg">…</Stack>
     * // → flex flex-row lg:flex-col
     */
    horizontalUntil?: StackBreakpoint
    /**
     * Tailwind divide utility applied between children (e.g. `'divide-x'`, `'divide-y'`).
     *
     * @example
     * <Stack divider="divide-x" dividerColor="divide-gray-200">…</Stack>
     */
    divider?: string
    /**
     * Tailwind divide color utility (e.g. `'divide-gray-200'`, `'dark:divide-polar-800'`).
     * Only meaningful when `divider` is set.
     */
    dividerColor?: string
  }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveDirection(
  horizontal?: boolean,
  vertical?: boolean,
  verticalUntil?: StackBreakpoint,
  horizontalUntil?: StackBreakpoint,
): FlexContainerProps['flexDirection'] {
  if (verticalUntil) {
    const map: Partial<Record<Breakpoint, 'row' | 'column'>> = {
      default: 'column',
    }
    map[verticalUntil] = 'row'
    return map
  }
  if (horizontalUntil) {
    const map: Partial<Record<Breakpoint, 'row' | 'column'>> = {
      default: 'row',
    }
    map[horizontalUntil] = 'column'
    return map
  }
  if (vertical) return 'column'
  if (horizontal) return 'row'

  return 'row'
}

// ─── Stack ────────────────────────────────────────────────────────────────────

/**
 * Orbit Stack — the primary flex layout primitive.
 *
 * Always renders as `display="flex"`. Defaults to a horizontal row.
 * Use `vertical` for a column, `verticalUntil` / `horizontalUntil` for
 * responsive direction changes. All Box token props (spacing, color, radius)
 * and flex child props (flex, alignSelf, …) are forwarded to the inner Box.
 *
 * @example
 * // Vertical on mobile, horizontal from xl upward
 * <Stack verticalUntil="xl" gap="spacing-3">
 *   <Box>…</Box>
 *   <Box>…</Box>
 * </Stack>
 *
 * @example
 * // Always vertical, centered cross-axis
 * <Stack vertical alignItems="center" gap="spacing-2">…</Stack>
 *
 * @example
 * // Divider between each child
 * <Stack vertical divider="divide-y" dividerColor="divide-gray-200 dark:divide-polar-800">
 *   <Item />
 *   <Item />
 * </Stack>
 */
export function Stack<E extends ElementType = 'div'>({
  horizontal,
  vertical,
  verticalUntil,
  horizontalUntil,
  alignItems,
  justifyContent,
  flexWrap,
  divider,
  dividerColor,
  className,
  children,
  ...boxProps
}: StackProps<E>) {
  const containerClasses = resolveContainerClasses({
    display: 'flex',
    flexDirection: resolveDirection(
      horizontal,
      vertical,
      verticalUntil,
      horizontalUntil,
    ),
    alignItems,
    justifyContent,
    flexWrap,
  })

  return (
    <Box
      className={twMerge(
        containerClasses,
        divider,
        dividerColor,
        className,
      )}
      {...(boxProps as BoxProps<OrbitTheme, E>)}
    >
      {children}
    </Box>
  )
}

Stack.displayName = 'Stack'
