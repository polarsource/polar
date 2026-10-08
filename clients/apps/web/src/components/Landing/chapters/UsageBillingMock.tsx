'use client'

import LogoIcon from '@/components/Brand/logos/LogoIcon'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Check, LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { UsageBillingCharge } from './UsageBillingCharge'
import {
  count,
  dollars,
  PRICE_PER_TOKEN,
  STARTING_TOKENS,
  useUsageConversation,
  VISIBLE_EVENTS,
} from './useUsageConversation'

const EventRow = ({
  tokens,
  pending = false,
}: {
  tokens: number
  pending?: boolean
}) => (
  <Box alignItems="center" justifyContent="between" columnGap="l">
    <Box alignItems="center" columnGap="s" color="text-secondary">
      {pending ? (
        <LoaderCircle size={12} className="animate-spin" />
      ) : (
        <Check size={12} />
      )}
      <Text variant="caption" monospace color={pending ? 'default' : 'muted'}>
        ai.tokens
      </Text>
    </Box>
    <Box alignItems="baseline" columnGap="l">
      <Text variant="caption" color="muted" tabularNums>
        {count(tokens)}
      </Text>
      <Box minWidth={64} justifyContent="end">
        <Text
          variant="caption"
          tabularNums
          color={pending ? 'muted' : 'default'}
        >
          {pending ? 'Metering' : `+${dollars(tokens * PRICE_PER_TOKEN, 4)}`}
        </Text>
      </Box>
    </Box>
  </Box>
)

const Panel = ({ children }: { children: ReactNode }) => (
  <Box
    width="100%"
    height="100%"
    flexDirection="column"
    backgroundColor="background-primary"
    borderWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
  >
    {children}
  </Box>
)

export const UsageBillingMock = () => {
  const { ref, scenario, phase, typed, streamed, settled, billed } =
    useUsageConversation()
  const totalTokens = STARTING_TOKENS + billed + streamed

  return (
    <Box
      ref={ref}
      position="relative"
      width="100%"
      flexDirection="column"
      rowGap="l"
      overflow="hidden"
      height={{ md: '34rem' }}
    >
      <Box
        position={{ base: 'relative', md: 'absolute' }}
        top={{ md: '3rem' }}
        left={{ md: 0 }}
        width={{ base: '100%', md: '60%' }}
        height={{ md: '38rem' }}
      >
        <Panel>
          <Box alignItems="center" columnGap="s" padding="l">
            <Box
              width={20}
              height={20}
              alignItems="center"
              justifyContent="center"
              backgroundColor="background-card"
            >
              <Text variant="caption">L</Text>
            </Box>
            <Text variant="body" color="muted">
              Lumen Assistant
            </Text>
          </Box>
          <Box
            flexDirection="column"
            rowGap="l"
            paddingHorizontal="l"
            paddingBottom="l"
            maxWidth={{ md: '58%' }}
            minHeight={{ base: '13rem', md: 'auto' }}
          >
            <Box
              alignSelf="start"
              padding="m"
              backgroundColor="background-card"
            >
              <Text variant="body">{scenario.prompt}</Text>
            </Box>
            <Text variant="body" color="muted">
              {scenario.answer.slice(0, typed)}
              <Box as="span" visibility="hidden">
                {scenario.answer.slice(typed)}
              </Box>
            </Text>
          </Box>
        </Panel>
      </Box>

      <Box
        position={{ base: 'relative', md: 'absolute' }}
        top={{ md: 0 }}
        left={{ md: '38%' }}
        right={{ md: 0 }}
        height={{ md: '38rem' }}
        boxShadow="xl"
      >
        <Panel>
          <Box
            alignItems="center"
            justifyContent="between"
            padding="l"
            borderBottomWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
          >
            <Box alignItems="center" columnGap="xs">
              <LogoIcon size={24} />
              <Text variant="body">Acme Inc</Text>
              <Text variant="body" color="muted">
                on Lumen Pro
              </Text>
            </Box>
            <Text variant="caption" color="muted">
              Current cycle
            </Text>
          </Box>
          <Box flexDirection="column" rowGap="xs" padding="l">
            <Text variant="heading-s" tabularNums>
              {count(totalTokens)}
            </Text>
            <Text variant="body" color="muted">
              tokens metered
            </Text>
          </Box>
          <Box
            flexDirection="column"
            rowGap="m"
            padding="l"
            borderTopWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
          >
            <Box justifyContent="between">
              <Text variant="caption" color="muted">
                Events
              </Text>
              <Text variant="caption" color="muted">
                $2.00 per 1M tokens
              </Text>
            </Box>
            {phase === 'prompt' ? null : (
              <EventRow tokens={streamed} pending={phase === 'streaming'} />
            )}
            {settled
              .slice(
                0,
                phase === 'prompt' ? VISIBLE_EVENTS : VISIBLE_EVENTS - 1,
              )
              .map((tokens, position) => (
                <EventRow key={`${position}-${tokens}`} tokens={tokens} />
              ))}
          </Box>
          <Box paddingHorizontal="l" paddingBottom="l">
            <UsageBillingCharge usageCharge={totalTokens * PRICE_PER_TOKEN} />
          </Box>
        </Panel>
      </Box>
    </Box>
  )
}
