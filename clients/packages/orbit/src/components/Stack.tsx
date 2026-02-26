import {
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
// Direct 1:1 mapping to Tailwind's spacing scale — gap={4} → gap-4 (16 px).
// Includes all standard Tailwind steps up to 48 (192 px).

export type StackGap =
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 14
  | 16
  | 20
  | 24
  | 28
  | 32
  | 36
  | 40
  | 44
  | 48

const GAP_CLASSES: Record<StackGap, string> = {
  0: 'gap-0',
  1: 'gap-1',
  2: 'gap-2',
  3: 'gap-3',
  4: 'gap-4',
  5: 'gap-5',
  6: 'gap-6',
  7: 'gap-7',
  8: 'gap-8',
  9: 'gap-9',
  10: 'gap-10',
  11: 'gap-11',
  12: 'gap-12',
  14: 'gap-14',
  16: 'gap-16',
  20: 'gap-20',
  24: 'gap-24',
  28: 'gap-28',
  32: 'gap-32',
  36: 'gap-36',
  40: 'gap-40',
  44: 'gap-44',
  48: 'gap-48',
}

const GAP_X_CLASSES: Record<StackGap, string> = {
  0: 'gap-x-0',
  1: 'gap-x-1',
  2: 'gap-x-2',
  3: 'gap-x-3',
  4: 'gap-x-4',
  5: 'gap-x-5',
  6: 'gap-x-6',
  7: 'gap-x-7',
  8: 'gap-x-8',
  9: 'gap-x-9',
  10: 'gap-x-10',
  11: 'gap-x-11',
  12: 'gap-x-12',
  14: 'gap-x-14',
  16: 'gap-x-16',
  20: 'gap-x-20',
  24: 'gap-x-24',
  28: 'gap-x-28',
  32: 'gap-x-32',
  36: 'gap-x-36',
  40: 'gap-x-40',
  44: 'gap-x-44',
  48: 'gap-x-48',
}

const GAP_Y_CLASSES: Record<StackGap, string> = {
  0: 'gap-y-0',
  1: 'gap-y-1',
  2: 'gap-y-2',
  3: 'gap-y-3',
  4: 'gap-y-4',
  5: 'gap-y-5',
  6: 'gap-y-6',
  7: 'gap-y-7',
  8: 'gap-y-8',
  9: 'gap-y-9',
  10: 'gap-y-10',
  11: 'gap-y-11',
  12: 'gap-y-12',
  14: 'gap-y-14',
  16: 'gap-y-16',
  20: 'gap-y-20',
  24: 'gap-y-24',
  28: 'gap-y-28',
  32: 'gap-y-32',
  36: 'gap-y-36',
  40: 'gap-y-40',
  44: 'gap-y-44',
  48: 'gap-y-48',
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
     * Gap between children — Tailwind spacing scale (gap-N).
     * @example <Stack vertical gap={4}>…</Stack>  // gap-4 = 16 px
     */
    gap?: StackGap
    /**
     * Horizontal (column) gap — Tailwind spacing scale (gap-x-N).
     * @example <Stack flexWrap="wrap" horizontalGap={8} verticalGap={4}>…</Stack>
     */
    horizontalGap?: StackGap
    /**
     * Vertical (row) gap — Tailwind spacing scale (gap-y-N).
     * @example <Stack flexWrap="wrap" horizontalGap={8} verticalGap={4}>…</Stack>
     */
    verticalGap?: StackGap
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
  horizontalGap,
  verticalGap,
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

  const flexChildClasses = resolveFlexChildClasses({
    flex,
    alignSelf,
    flexGrow,
    flexShrink,
  })

  return (
    <Tag
      className={twMerge(
        containerClasses,
        flexChildClasses,
        gap !== undefined ? GAP_CLASSES[gap] : undefined,
        horizontalGap !== undefined ? GAP_X_CLASSES[horizontalGap] : undefined,
        verticalGap !== undefined ? GAP_Y_CLASSES[verticalGap] : undefined,
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
