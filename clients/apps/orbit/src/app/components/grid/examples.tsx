import { Box } from '@polar-sh/orbit/Box'
import { Grid, GridItem, Text } from '@polar-sh/orbit'
import { type ReactNode } from 'react'

function Cell({ children }: { children: ReactNode }) {
  return (
    <Box
      alignItems="center"
      justifyContent="center"
      minHeight={56}
      borderRadius="m"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      backgroundColor="background-secondary"
    >
      <Text variant="label" color="default">
        {children}
      </Text>
    </Box>
  )
}

export function BasicGridDemo() {
  return (
    <Grid templateColumns="repeat(3, 1fr)" gap="m" width="100%">
      {Array.from({ length: 6 }, (_, i) => (
        <Cell key={i}>{i + 1}</Cell>
      ))}
    </Grid>
  )
}

export function ResponsiveGridDemo() {
  return (
    <Grid
      templateColumns={{
        base: '1fr',
        md: 'repeat(2, 1fr)',
        xl: 'repeat(4, 1fr)',
      }}
      gap="m"
      width="100%"
    >
      {Array.from({ length: 4 }, (_, i) => (
        <Cell key={i}>{i + 1}</Cell>
      ))}
    </Grid>
  )
}

export function AreasGridDemo() {
  return (
    <Grid
      templateAreas={'"header header" "sidebar main"'}
      templateColumns="160px 1fr"
      gap="m"
      width="100%"
    >
      <GridItem area="header">
        <Cell>header</Cell>
      </GridItem>
      <GridItem area="sidebar">
        <Cell>sidebar</Cell>
      </GridItem>
      <GridItem area="main">
        <Cell>main</Cell>
      </GridItem>
    </Grid>
  )
}

export function PlacementGridDemo() {
  return (
    <Grid templateColumns="repeat(4, 1fr)" gap="m" width="100%">
      <GridItem colSpan={2}>
        <Cell>colSpan 2</Cell>
      </GridItem>
      <GridItem colStart={3} colEnd={5} rowSpan={2}>
        <Cell>colStart 3, rowSpan 2</Cell>
      </GridItem>
      <GridItem>
        <Cell>auto</Cell>
      </GridItem>
      <GridItem>
        <Cell>auto</Cell>
      </GridItem>
    </Grid>
  )
}
