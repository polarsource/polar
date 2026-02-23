import React, { type ElementType, type JSX, type ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'
import type {
  Breakpoint,
  BoxProps,
  FlexContainerProps,
} from '../primitives/createBox'
import { resolveContainerClasses } from '../primitives/resolveProperties'
import { orbitTheme, type OrbitSpacing, type OrbitTheme } from '../tokens/theme'
import { Box } from './Box'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Any breakpoint except 'default', used to specify a layout switch point. */
export type StackBreakpoint = Exclude<Breakpoint, 'default'>

/**
 * Container props exposed directly on Stack.
 * display is omitted — Stack is always `flex`.
 * flexDirection is omitted — use vertical / horizontal / verticalUntil / horizontalUntil.
 */
type StackContainerProps = Omit<FlexContainerProps, 'display' | 'flexDirection'> & {
  /** Gap between flex children, resolved via the Orbit spacing scale. */
  gap?: OrbitSpacing
  /** Row gap between flex children, resolved via the Orbit spacing scale. */
  rowGap?: OrbitSpacing
  /** Column gap between flex children, resolved via the Orbit spacing scale. */
  columnGap?: OrbitSpacing
}

export type StackProps<E extends ElementType = 'div'> = BoxProps<OrbitTheme, E> &
  StackContainerProps & {
    /**
     * Render children in a row (horizontal flex). Equivalent to flex-row.
     * Takes precedence over the default column direction.
     *
     * @example
     * <Stack horizontal gap={2}>…</Stack>
     */
    horizontal?: boolean
    /**
     * Render children in a column (vertical flex). This is the default.
     * Useful when combining with verticalUntil to be explicit.
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
     * Element inserted between each child. Renders the divider node
     * between adjacent children — does not add one before the first
     * or after the last.
     *
     * @example
     * <Stack divider={<Box className="border-t border-neutral-200 dark:border-polar-800" />}>
     *   <Item />
     *   <Item />
     * </Stack>
     */
    divider?: ReactNode
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
  if (horizontal) return 'row'
  if (vertical) return 'column'
  return 'column'
}

function withDividers(children: ReactNode, divider: ReactNode): ReactNode {
  const childArray = React.Children.toArray(children)
  return (
    <>
      {childArray.map((child, i) => (
        <React.Fragment key={i}>
          {i > 0 && divider}
          {child}
        </React.Fragment>
      ))}
    </>
  )
}

// ─── Stack ────────────────────────────────────────────────────────────────────

/**
 * Orbit Stack — the primary flex layout primitive.
 *
 * Always renders as `display="flex"`. Defaults to a vertical column.
 * Use `horizontal` for a row, `verticalUntil` / `horizontalUntil` for
 * responsive direction changes. All Box token props (spacing, color, radius)
 * and flex child props (flex, alignSelf, …) are forwarded to the inner Box.
 *
 * @example
 * // Vertical on mobile, horizontal from xl upward
 * <Stack verticalUntil="xl" gap={3}>
 *   <Box>…</Box>
 *   <Box>…</Box>
 * </Stack>
 *
 * @example
 * // Always horizontal, centered cross-axis
 * <Stack horizontal alignItems="center" gap={2}>…</Stack>
 *
 * @example
 * // Divider between each child
 * <Stack divider={<Box className="border-t border-neutral-200 dark:border-polar-800" />}>
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
  gap,
  rowGap,
  columnGap,
  divider,
  className,
  children,
  ...boxProps
}: StackProps<E>): JSX.Element {
  const containerClasses = resolveContainerClasses({
    display: 'flex',
    flexDirection: resolveDirection(horizontal, vertical, verticalUntil, horizontalUntil),
    alignItems,
    justifyContent,
    flexWrap,
  })

  const gapClasses = [
    gap !== undefined ? orbitTheme.spacing[gap]?.gap : undefined,
    rowGap !== undefined ? orbitTheme.spacing[rowGap]?.rowGap : undefined,
    columnGap !== undefined ? orbitTheme.spacing[columnGap]?.columnGap : undefined,
  ].filter(Boolean).join(' ')

  return (
    <Box
      className={twMerge(containerClasses, gapClasses, className)}
      {...(boxProps as BoxProps<OrbitTheme, E>)}
    >
      {divider ? withDividers(children, divider) : children}
    </Box>
  )
}

Stack.displayName = 'Stack'
