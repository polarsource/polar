'use client'

import {
  Toplist,
  ToplistHeader,
  ToplistItem,
  ToplistText,
} from '@/components/Shared/Toplist'
import { Avatar, Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { identityHref } from '../identities'
import { Delta } from '../Simulation/Delta'
import { usd } from '../Simulation/format'
import { Mover } from './insights'

const LIMIT = 5

const MoverList = ({
  title,
  caption,
  items,
  base,
}: {
  title: string
  caption: string
  items: Mover<{ id: string; name: string }>[]
  base: string
}) => (
  <Box flexDirection="column" rowGap="l">
    <ToplistHeader title={title} caption={caption} />
    {items.length === 0 ? (
      <Text color="muted" variant="caption">
        Nothing this week
      </Text>
    ) : (
      <Toplist>
        {items.map((mover) => (
          <ToplistItem
            key={mover.identity.id}
            href={identityHref(base, mover.identity.id)}
          >
            <Avatar
              className="h-8 w-8"
              avatar_url={null}
              name={mover.identity.name}
            />
            <ToplistText
              primary={mover.identity.name}
              secondary={`${usd(mover.recent)} this week`}
            />
            <Box marginLeft="auto" flexShrink={0}>
              <Delta
                delta={mover.delta}
                ratio={mover.ratio}
                variant="caption"
              />
            </Box>
          </ToplistItem>
        ))}
      </Toplist>
    )}
  </Box>
)

export const IdentitiesMovers = ({
  movers,
  base,
}: {
  movers: Mover<{ id: string; name: string }>[]
  base: string
}) => {
  const growing = movers
    .filter((mover) => mover.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, LIMIT)
  const slowing = movers
    .filter((mover) => mover.delta < 0)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, LIMIT)

  return (
    <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap="3xl">
      <MoverList
        title="Growing"
        caption="Usage vs the week before"
        items={growing}
        base={base}
      />
      <MoverList
        title="Slowing"
        caption="Usage vs the week before"
        items={slowing}
        base={base}
      />
    </Grid>
  )
}
