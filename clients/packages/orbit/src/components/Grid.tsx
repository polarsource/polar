'use client'

import * as React from 'react'
import type { GridPlacement } from '../utils/grid'
import type { ResponsiveValue } from '../utils/types'
import { Box, type BoxProps } from './Box'

// Verbose CSS-grid props are re-exposed under the shorter, Chakra-style names
// below, so they're omitted from the inherited Box props to avoid duplication.
type OmittedGridProps =
  | 'display'
  | 'gridTemplateColumns'
  | 'gridTemplateRows'
  | 'gridTemplateAreas'
  | 'gridColumn'
  | 'gridRow'
  | 'gridAutoFlow'
  | 'gridAutoRows'
  | 'gridAutoColumns'

export interface GridProps extends Omit<BoxProps, OmittedGridProps> {
  /** `grid-template-columns`, e.g. `"repeat(3, 1fr)"`. */
  templateColumns?: ResponsiveValue<string>
  /** `grid-template-rows`. */
  templateRows?: ResponsiveValue<string>
  /** `grid-template-areas`. */
  templateAreas?: ResponsiveValue<string>
  /** `grid-auto-flow`. */
  autoFlow?: BoxProps['gridAutoFlow']
  /** `grid-auto-rows`. */
  autoRows?: ResponsiveValue<string>
  /** `grid-auto-columns`. */
  autoColumns?: ResponsiveValue<string>
  /** `grid-column` — a line, or `<start> / <end>`. */
  column?: ResponsiveValue<GridPlacement>
  /** `grid-row` — a line, or `<start> / <end>`. */
  row?: ResponsiveValue<GridPlacement>
  /** Render as `inline-grid` instead of `grid`. */
  inline?: boolean
}

/**
 * Grid is a Box that lays out its children with CSS grid. It defaults to
 * `display: grid` and exposes the grid properties under short prop names.
 * Spacing (`gap`/`rowGap`/`columnGap`) and every other Box prop are inherited.
 */
export const Grid = React.forwardRef<HTMLElement, GridProps>(function Grid(
  {
    templateColumns,
    templateRows,
    templateAreas,
    autoFlow,
    autoRows,
    autoColumns,
    column,
    row,
    inline,
    ...rest
  },
  ref,
) {
  return (
    <Box
      ref={ref}
      display={inline ? 'inline-grid' : 'grid'}
      gridTemplateColumns={templateColumns}
      gridTemplateRows={templateRows}
      gridTemplateAreas={templateAreas}
      gridAutoFlow={autoFlow}
      gridAutoRows={autoRows}
      gridAutoColumns={autoColumns}
      gridColumn={column}
      gridRow={row}
      {...rest}
    />
  )
})

Grid.displayName = 'Grid'
