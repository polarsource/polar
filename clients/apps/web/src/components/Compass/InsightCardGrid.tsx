'use client'

import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import { InsightCard } from './InsightCard'

/**
 * The connected card container shared by every insights surface: one rounded
 * border around the whole block, internal dividers between cells (left on lg,
 * top on base so the cells stack on mobile with clean separators).
 */
export const InsightCardGrid = ({
  organization,
  insights,
  layout,
  columns,
  size,
}: {
  organization: schemas['Organization']
  insights: schemas['Insight'][]
  layout: 'grid' | 'column'
  columns: 2 | 3
  size: 'default' | 'small'
}) => (
  <Box
    display="grid"
    gridTemplateColumns={
      layout === 'column'
        ? '1fr'
        : { base: '1fr', lg: `repeat(${columns}, 1fr)` }
    }
    alignItems="stretch"
    overflow="hidden"
    borderRadius="l"
    borderWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
  >
    {insights.map((insight, idx) => {
      const col = idx % columns
      const row = Math.floor(idx / columns)
      return (
        <Box
          key={insight.id}
          padding={size === 'small' ? 'xl' : '2xl'}
          borderStyle="solid"
          borderColor="border-primary"
          borderLeftWidth={
            layout === 'column' ? 0 : { base: 0, lg: col === 0 ? 0 : 1 }
          }
          borderTopWidth={
            layout === 'column'
              ? idx === 0
                ? 0
                : 1
              : { base: idx === 0 ? 0 : 1, lg: row === 0 ? 0 : 1 }
          }
        >
          <InsightCard
            organization={organization}
            insight={insight}
            size={size}
          />
        </Box>
      )
    })}
  </Box>
)
