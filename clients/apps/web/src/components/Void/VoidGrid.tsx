'use client'

import { Grid, GridItem } from '@polar-sh/orbit'
import { ComponentProps } from 'react'

export const VOID_GRID_COLUMNS = 12

/**
 * Column placement in 12-column units, per breakpoint. A bare number applies
 * from `base` up; object keys override from that breakpoint on.
 */
export type VoidSpan =
  | number
  | { base?: number; sm?: number; md?: number; lg?: number; xl?: number }

/** Full width on mobile, half on tablet, quarter on desktop. */
const DEFAULT_CELL_SPAN: VoidSpan = { base: 12, md: 6, lg: 3 }

type VoidGridProps = ComponentProps<typeof Grid>

/**
 * The Void grid: always 12 columns, flush (no column gutter), so every
 * surface shares one placement vocabulary. Pass any Grid prop to override
 * the defaults.
 */
export const VoidGrid = ({ children, ...props }: VoidGridProps) => (
  <Grid
    templateColumns={`repeat(${VOID_GRID_COLUMNS}, 1fr)`}
    columnGap="none"
    rowGap="3xl"
    {...props}
  >
    {children}
  </Grid>
)

interface VoidItemProps extends ComponentProps<typeof GridItem> {
  /** How many of the 12 columns to span. Defaults to the full row. */
  span?: VoidSpan
  /** 1-based column to start at, for explicit placement. */
  start?: VoidSpan
}

/**
 * Bare placement primitive: positions a child on the 12-column grid with no
 * cell chrome. Use for layout-level regions (sidebar, page content) or any
 * child that brings its own styling.
 */
export const VoidItem = ({
  span = 12,
  start,
  children,
  ...props
}: VoidItemProps) => (
  <GridItem colSpan={span} colStart={start} flexDirection="column" {...props}>
    {children}
  </GridItem>
)

interface VoidCellProps extends VoidItemProps {
  minHeight?: number
}

/**
 * A Void content cell: 12-column placement plus the hairline-and-inset
 * chrome shared by every cell in a section grid.
 */
export const VoidCell = ({
  span = DEFAULT_CELL_SPAN,
  minHeight,
  children,
  ...props
}: VoidCellProps) => (
  <VoidItem
    span={span}
    borderLeftWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
    paddingLeft="xl"
    paddingRight="xl"
    minHeight={minHeight}
    {...props}
  >
    {children}
  </VoidItem>
)
