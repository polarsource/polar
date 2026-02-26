import React, {
  type ComponentPropsWithoutRef,
  type ElementType,
  type ReactNode,
} from 'react'
import { twMerge } from 'tailwind-merge'
import {
  type Breakpoint,
  type FlexChildProps,
  type FlexContainerProps,
  resolveContainerClasses,
  resolveFlexChildClasses,
} from '../primitives/resolveProperties'

// ─── Types ────────────────────────────────────────────────────────────────────

export type StackBreakpoint = Exclude<Breakpoint, 'default'>

type StackContainerProps = Omit<FlexContainerProps, 'display' | 'flexDirection'>

// ─── Gap scale ────────────────────────────────────────────────────────────────
// Maps numeric step (0–14) to a CSS-variable gap class (Tailwind v4 shorthand).
// Each step corresponds to the SPACING_* design token.

export type StackGap = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14

const GAP_CLASSES: Record<StackGap, string> = {
  0:  'gap-0',
  1:  'gap-1',
  2:  'gap-2',
  3:  'gap-3',
  4:  'gap-4',
  5:  'gap-5',
  6:  'gap-6',
  7:  'gap-7',
  8:  'gap-8',
  9:  'gap-9',
  10: 'gap-10',
  11: 'gap-11',
  12: 'gap-12',
  13: 'gap-14',
  14: 'gap-16',
}

// ─── StackProps ───────────────────────────────────────────────────────────────

type StackOwnProps<E extends ElementType> = FlexChildProps &
  StackContainerProps & {
    as?: E
    horizontal?: boolean
    /**
     * Render children in a column (flex-col).
     * @example <Stack vertical gap={2}>…</Stack>
     */
    vertical?: boolean
    /**
     * Stack column until this breakpoint, then switch to row.
     * @example <Stack verticalUntil="xl">…</Stack>
     */
    verticalUntil?: StackBreakpoint
    /**
     * Stack row until this breakpoint, then switch to column.
     * @example <Stack horizontalUntil="lg">…</Stack>
     */
    horizontalUntil?: StackBreakpoint
    /**
     * Gap between children — design-token spacing scale (0–14).
     * @example <Stack vertical gap={4}>…</Stack>  // 16 px
     */
    gap?: StackGap
    /** Tailwind divide utility, e.g. `'divide-y'`. */
    divider?: string
    className?: string
    children?: ReactNode
  }

export type StackProps<E extends ElementType = 'div'> = StackOwnProps<E> &
  Omit<ComponentPropsWithoutRef<E>, keyof StackOwnProps<E>>

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveDirection(
  horizontal?: boolean,
  vertical?: boolean,
  verticalUntil?: StackBreakpoint,
  horizontalUntil?: StackBreakpoint,
): FlexContainerProps['flexDirection'] {
  if (verticalUntil) {
    const map: Partial<Record<Breakpoint, 'row' | 'column'>> = { default: 'column' }
    map[verticalUntil] = 'row'
    return map
  }
  if (horizontalUntil) {
    const map: Partial<Record<Breakpoint, 'row' | 'column'>> = { default: 'row' }
    map[horizontalUntil] = 'column'
    return map
  }
  if (vertical) return 'column'
  if (horizontal) return 'row'
  return 'row'
}

// ─── Stack ────────────────────────────────────────────────────────────────────

export function Stack<E extends ElementType = 'div'>({
  as,
  horizontal,
  vertical,
  verticalUntil,
  horizontalUntil,
  alignItems,
  justifyContent,
  flexWrap,
  gap,
  divider,
  flex,
  alignSelf,
  flexGrow,
  flexShrink,
  className,
  children,
  ...rest
}: StackProps<E>) {
  const Tag = (as ?? 'div') as ElementType

  const containerClasses = resolveContainerClasses({
    display: 'flex',
    flexDirection: resolveDirection(horizontal, vertical, verticalUntil, horizontalUntil),
    alignItems,
    justifyContent,
    flexWrap,
  })

  const flexChildClasses = resolveFlexChildClasses({ flex, alignSelf, flexGrow, flexShrink })

  return (
    <Tag
      className={twMerge(
        containerClasses,
        flexChildClasses,
        gap !== undefined ? GAP_CLASSES[gap] : undefined,
        divider,
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
}

Stack.displayName = 'Stack'
