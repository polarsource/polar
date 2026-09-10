'use client'

import {
  Toplist,
  ToplistHeader,
  ToplistItem,
  ToplistText,
  ToplistValue,
} from '@/components/Shared/Toplist'
import { formatHumanFriendlyScalar } from '@/utils/formatters'
import { formatCurrency } from '@polar-sh/currency'
import { Avatar, Grid } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { subDays } from 'date-fns'
import { VoidData, VoidIdentity } from './types'
import { describeKinds, topSpenders } from './identities'

const LIMIT = 5

const usd = (cents: number) => formatCurrency('statistics')(cents, 'usd')

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? '' : 's'}`

const describeChildren = (
  identity: VoidIdentity,
  identities: VoidIdentity[],
) => {
  const children = identities.filter(
    (candidate) => candidate.parent_id === identity.id,
  )
  return children.length > 0 ? describeKinds(children) : identity.kind
}

const joinedLabel = (timestamp: string) =>
  new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })

export const VoidToplists = ({
  data,
  base,
}: {
  data: VoidData
  base: string
}) => {
  const since = subDays(new Date(), 30)
  const top = topSpenders(data.identities).slice(0, LIMIT)
  const newest = data.identities
    .filter(
      (identity) =>
        identity.parent_id === null && new Date(identity.created_at) >= since,
    )
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, LIMIT)
  const meters = [...data.meters]
    .sort((a, b) => b.billed - a.billed)
    .slice(0, LIMIT)

  return (
    <Grid templateColumns={{ base: '1fr', xl: '1fr 1fr 1fr' }} gap="3xl">
      <Box flexDirection="column" rowGap="l">
        <ToplistHeader title="Top Identities" caption="By 30-day spend" />
        <Toplist>
          {top.map((identity) => (
            <ToplistItem
              key={identity.id}
              href={`${base}/identities/${identity.id}`}
            >
              <Avatar
                className="h-8 w-8"
                avatar_url={null}
                name={identity.name}
              />
              <ToplistText
                primary={identity.name}
                secondary={describeChildren(identity, data.identities)}
              />
              <ToplistValue
                value={usd(identity.spend)}
                caption={plural(identity.orders, 'order')}
              />
            </ToplistItem>
          ))}
        </Toplist>
      </Box>
      <Box flexDirection="column" rowGap="l">
        <ToplistHeader title="New Identities" caption="Joined in 30 days" />
        <Toplist>
          {newest.map((identity) => (
            <ToplistItem
              key={identity.id}
              href={`${base}/identities/${identity.id}`}
            >
              <Avatar
                className="h-8 w-8"
                avatar_url={null}
                name={identity.name}
              />
              <ToplistText
                primary={identity.name}
                secondary={describeChildren(identity, data.identities)}
              />
              <ToplistValue
                value={identity.spend > 0 ? usd(identity.spend) : 'No spend'}
                caption={joinedLabel(identity.created_at)}
              />
            </ToplistItem>
          ))}
        </Toplist>
      </Box>
      <Box flexDirection="column" rowGap="l">
        <ToplistHeader title="Usage Billed" caption="By meter" />
        <Toplist>
          {meters.map((meter) => (
            <ToplistItem
              key={meter.id}
              href={`${base}/definition/meters/${meter.id}`}
            >
              <ToplistText
                primary={meter.name}
                secondary={`${formatHumanFriendlyScalar(meter.units)} units`}
              />
              <ToplistValue value={usd(meter.billed)} />
            </ToplistItem>
          ))}
        </Toplist>
      </Box>
    </Grid>
  )
}
