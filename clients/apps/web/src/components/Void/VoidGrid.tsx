'use client'

import { Grid, GridItem } from '@polar-sh/orbit'
import { PropsWithChildren } from 'react'

type ResponsiveSpan = number | { base?: number; md?: number; lg?: number }

export const VoidGrid = ({ children }: PropsWithChildren) => (
  <Grid
    templateColumns={{
      base: '1fr',
      md: 'repeat(2, 1fr)',
      lg: 'repeat(4, 1fr)',
    }}
    columnGap="none"
    rowGap="3xl"
  >
    {children}
  </Grid>
)

interface VoidCellProps {
  colSpan?: ResponsiveSpan
  minHeight?: number
}

export const VoidCell = ({
  colSpan,
  minHeight,
  children,
}: PropsWithChildren<VoidCellProps>) => (
  <GridItem
    colSpan={colSpan}
    flexDirection="column"
    borderLeftWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
    paddingLeft="xl"
    paddingRight="xl"
    minHeight={minHeight}
  >
    {children}
  </GridItem>
)
