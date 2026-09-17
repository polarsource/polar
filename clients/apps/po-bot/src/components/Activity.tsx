'use client'

import { pct, usd } from '@/format'
import type { Mix } from '@/activity'
import { Pill, Text, type PillColor } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Card } from './Card'
import { Meter } from './Meter'

const ACTIVITY_COLOR = {
  plan: 'purple',
  retrieve: 'blue',
  implement: 'green',
  act: 'yellow',
  review: 'gray',
  retry: 'red',
  other: 'gray',
  pending: 'gray',
  unlabeled: 'yellow',
} as const satisfies Record<string, PillColor>

const colorOf = (slug: string): PillColor =>
  slug in ACTIVITY_COLOR
    ? ACTIVITY_COLOR[slug as keyof typeof ACTIVITY_COLOR]
    : 'gray'

export const ActivityPill = ({ slug }: { slug: string }) => (
  <Pill color={colorOf(slug)} className="font-mono text-[10px]">
    {slug}
  </Pill>
)

export const MixCard = ({
  title,
  taxonomy,
  mix,
}: {
  title: string
  taxonomy: string
  mix: Mix
}) => (
  <Card flexDirection="column" rowGap="xs" padding="s">
    <Box justifyContent="between" alignItems="baseline" columnGap="s">
      <Text variant="caption" color="muted" as="h2">
        {title}
      </Text>
      <Text variant="caption" color="muted" as="span">
        Jev · {taxonomy}
      </Text>
    </Box>
    {mix.shares.length === 0 ? (
      <Text variant="caption" color="muted">
        {mix.pendingCost > 0 ? 'Classifying spans…' : 'No classified spans yet'}
      </Text>
    ) : (
      <Box flexDirection="column" rowGap="s">
        {mix.shares.map((share) => (
          <Box key={share.slug} flexDirection="column" rowGap="xs">
            <Box justifyContent="between" alignItems="center" columnGap="s">
              <ActivityPill slug={share.slug} />
              <Text variant="caption" color="muted" as="span" tabularNums>
                {pct(share.share)} · {share.spans}
              </Text>
            </Box>
            <Meter
              share={share.share * 100}
              spent={share.slug === 'retry'}
              height={4}
            />
          </Box>
        ))}
      </Box>
    )}
    {(mix.pendingCost > 0 || mix.unlabeledCost > 0) && (
      <Text variant="caption" color="muted" as="span" tabularNums>
        {mix.pendingCost > 0 && `pending ${usd(mix.pendingCost)}`}
        {mix.pendingCost > 0 && mix.unlabeledCost > 0 && ' · '}
        {mix.unlabeledCost > 0 && `unlabeled ${usd(mix.unlabeledCost)}`}
      </Text>
    )}
  </Card>
)
