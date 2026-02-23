import { type ElementType, type JSX } from 'react'
import { twMerge } from 'tailwind-merge'
import type {
  Breakpoint,
  BoxProps,
  FlexContainerProps,
} from '../primitives/createBox'
import { resolveContainerClasses } from '../primitives/resolveProperties'
import type { OrbitTheme } from '../tokens/theme'
import { Box } from './Box'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Any breakpoint except 'default', used to specify a layout switch point. */
export type StackBreakpoint = Exclude<Breakpoint, 'default'>

/**
 * Container props exposed directly on Stack.
 * display is omitted — Stack is always `flex`.
 * flexDirection is omitted — use verticalUntil / horizontalUntil helpers.
 */
type StackContainerProps = Omit<FlexContainerProps, 'display' | 'flexDirection'>

export type StackProps<E extends ElementType = 'div'> = BoxProps<OrbitTheme, E> &
  StackContainerProps & {
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
  }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveDirection(
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
  return 'column'
}

// ─── Stack ────────────────────────────────────────────────────────────────────

/**
 * Orbit Stack — the primary flex layout primitive.
 *
 * Always renders as `display="flex"`. Use `verticalUntil` / `horizontalUntil`
 * to flip the flex axis at a Tailwind breakpoint, or omit them for a plain
 * vertical stack. All Box token props (spacing, color, radius) and flex child
 * props (flex, alignSelf, …) are forwarded to the inner Box.
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
 * <Stack alignItems="center" gap={2}>…</Stack>
 */
export function Stack<E extends ElementType = 'div'>({
  verticalUntil,
  horizontalUntil,
  alignItems,
  justifyContent,
  flexWrap,
  className,
  ...boxProps
}: StackProps<E>): JSX.Element {
  const containerClasses = resolveContainerClasses({
    display: 'flex',
    flexDirection: resolveDirection(verticalUntil, horizontalUntil),
    alignItems,
    justifyContent,
    flexWrap,
  })

  return (
    <Box
      className={twMerge(containerClasses, className)}
      {...(boxProps as BoxProps<OrbitTheme, E>)}
    />
  )
}

Stack.displayName = 'Stack'
