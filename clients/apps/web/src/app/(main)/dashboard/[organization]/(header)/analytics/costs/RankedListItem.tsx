'use client'

import { Grid, GridItem, List, ListItem, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ReactNode } from 'react'

interface RankedListItemProps {
  itemKey: string
  rank: number
  label: ReactNode
  stats: ReactNode
  value: ReactNode
  share: number
  onSelect?: () => void
}

export const RankedListItem = ({
  itemKey,
  rank,
  label,
  stats,
  value,
  share,
  onSelect,
}: RankedListItemProps) => {
  const sharePct = Math.round(share * 100)
  return (
    <ListItem
      key={itemKey}
      className="flex-col items-stretch gap-3 py-4"
      onSelect={onSelect}
    >
      <Grid
        templateAreas={{
          base: '"rank label value" ". stats stats"',
          sm: '"rank label stats value"',
        }}
        templateColumns={{
          base: 'auto minmax(0, 1fr) auto',
          sm: 'auto minmax(0, 1fr) auto auto',
        }}
        alignItems="center"
        columnGap="l"
        rowGap="s"
      >
        <GridItem area="rank">
          <Text as="span" variant="caption" color="muted" tabularNums>
            {rank}
          </Text>
        </GridItem>
        <GridItem area="label" minWidth={0} alignItems="center" columnGap="m">
          {label}
        </GridItem>
        <GridItem
          area="stats"
          alignItems="center"
          flexWrap="wrap"
          justifyContent={{ sm: 'end' }}
          columnGap="m"
          rowGap="xs"
        >
          {stats}
        </GridItem>
        <GridItem area="value" justifyContent="end">
          {value}
        </GridItem>
      </Grid>
      <Box alignItems="center" columnGap="m">
        <Box
          position="relative"
          flex={1}
          height={4}
          overflow="hidden"
          borderRadius="full"
          backgroundColor="background-card"
        >
          <Box
            position="absolute"
            top={0}
            bottom={0}
            left={0}
            width={`${sharePct}%`}
            borderRadius="full"
            backgroundColor="background-inverse"
            transitionDuration="base"
          />
        </Box>
        <Box width={36} flexShrink={0} justifyContent="end">
          <Text as="span" variant="caption" color="muted" tabularNums>
            {sharePct}%
          </Text>
        </Box>
      </Box>
    </ListItem>
  )
}

interface RankedListProps {
  children: ReactNode
}

export const RankedList = ({ children }: RankedListProps) => (
  <List size="small">{children}</List>
)
