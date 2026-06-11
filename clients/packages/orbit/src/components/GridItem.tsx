'use client'

import * as React from 'react'
import type { GridLine } from '../utils/grid'
import type { ResponsiveValue } from '../utils/types'
import { Box, type BoxProps } from './Box'

// These grid-placement props are re-exposed under shorter names below.
type OmittedGridItemProps =
  | 'gridArea'
  | 'gridColumn'
  | 'gridRow'
  | 'gridColumnStart'
  | 'gridColumnEnd'
  | 'gridRowStart'
  | 'gridRowEnd'

// A span count: how many tracks to cover.
type Span = ResponsiveValue<number | 'auto'>
// A single placement line: a line number, `auto`, or `span N`.
type Line = ResponsiveValue<GridLine>

export interface GridItemProps extends Omit<BoxProps, OmittedGridItemProps> {
  /** `grid-area`. */
  area?: ResponsiveValue<string>
  /** Number of columns to span, or `"auto"`. */
  colSpan?: Span
  /** `grid-column-start`. */
  colStart?: Line
  /** `grid-column-end`. */
  colEnd?: Line
  /** Number of rows to span, or `"auto"`. */
  rowSpan?: Span
  /** `grid-row-start`. */
  rowStart?: Line
  /** `grid-row-end`. */
  rowEnd?: Line
}

function spanValue(value: number | 'auto'): string {
  return value === 'auto' ? 'auto' : `span ${value} / span ${value}`
}

// Apply `fn` to a plain value or to each entry of a responsive/pseudo object,
// preserving the breakpoint keys.
function mapResponsive<T, U>(
  value: ResponsiveValue<T> | undefined,
  fn: (v: T) => U,
): ResponsiveValue<U> | undefined {
  if (value === undefined) return undefined
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const out: Record<string, U> = {}
    for (const [key, v] of Object.entries(value)) {
      if (v !== undefined) out[key] = fn(v as T)
    }
    return out as ResponsiveValue<U>
  }
  return fn(value as T)
}

/**
 * GridItem positions a single child inside a `Grid`. `colSpan`/`rowSpan` set how
 * many tracks the item spans; `colStart`/`colEnd`/`rowStart`/`rowEnd` and `area`
 * place it explicitly. All other Box props are inherited.
 */
export const GridItem = React.forwardRef<HTMLElement, GridItemProps>(
  function GridItem(
    { area, colSpan, colStart, colEnd, rowSpan, rowStart, rowEnd, ...rest },
    ref,
  ) {
    return (
      <Box
        ref={ref}
        gridArea={area}
        gridColumn={mapResponsive(colSpan, spanValue)}
        gridColumnStart={colStart}
        gridColumnEnd={colEnd}
        gridRow={mapResponsive(rowSpan, spanValue)}
        gridRowStart={rowStart}
        gridRowEnd={rowEnd}
        {...rest}
      />
    )
  },
)

GridItem.displayName = 'GridItem'
