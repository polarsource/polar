'use client'

import { pct, usd } from '@/format'
import { TAXONOMY, type Mix } from '@/activity'
import { Pill, type PillColor } from '@polar-sh/orbit/Pill'
import { Text } from '@polar-sh/orbit/Text'
import { Box } from '@polar-sh/orbit/Box'
import { Meter } from './Meter'
import { SectionLabel } from './SectionLabel'

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

export const MixSection = ({ title, mix }: { title: string; mix: Mix }) => (
  <Box flexDirection="column" rowGap="s" width="100%">
    <SectionLabel
      aside={
        <Text variant="caption" color="muted" as="span">
          Jev {TAXONOMY}
        </Text>
      }
    >
      {title}
    </SectionLabel>
    {mix.shares.length === 0 ? (
      <Text variant="caption" color="muted" style={{ paddingInline: 4 }}>
        {mix.pendingCost > 0 ? 'Classifying spans…' : 'No classified spans yet'}
      </Text>
    ) : (
      <Box flexDirection="column" rowGap="s" paddingHorizontal="xs">
        {mix.shares.map((share) => (
          <Box key={share.slug} flexDirection="column" rowGap="xs">
            <Box justifyContent="between" alignItems="center" columnGap="s">
              <ActivityPill slug={share.slug} />
              <Text variant="caption" color="muted" as="span" tabularNums>
                {pct(share.share)}, {share.spans} spans
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
      <Text
        variant="caption"
        color="muted"
        as="span"
        tabularNums
        style={{ paddingInline: 4 }}
      >
        {mix.pendingCost > 0 && `pending ${usd(mix.pendingCost)}`}
        {mix.pendingCost > 0 && mix.unlabeledCost > 0 && ', '}
        {mix.unlabeledCost > 0 && `unlabeled ${usd(mix.unlabeledCost)}`}
      </Text>
    )}
  </Box>
)
