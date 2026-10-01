'use client'

import { useListWebhooksEndpoints } from '@/hooks/queries/webhooks'
import { api } from '@/utils/client'
import { unwrap } from '@polar-sh/client'
import { Button, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { IdLookup } from '../IdLookup'
import { downloadMapping } from '../mappingExport'
import {
  GoLiveKey,
  GoLiveStatus,
  GoLiveStep,
  goLiveSteps,
  readMarkedDone,
  writeMarkedDone,
} from './goLiveSteps'
import { LayoutProps, PhaseHeader } from './shared'

const STATUS: Record<
  GoLiveStatus,
  { label: string; color: 'green' | 'yellow' | 'blue' | 'gray' }
> = {
  done: { label: 'Done', color: 'green' },
  attention: { label: 'Needs attention', color: 'yellow' },
  waiting: { label: 'In progress', color: 'blue' },
  todo: { label: 'To do', color: 'gray' },
}

function ExternalLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} target={href.startsWith('http') ? '_blank' : undefined}>
      <Box
        as="span"
        display="inline-flex"
        alignItems="center"
        columnGap="xs"
        color={{ base: 'text-secondary', hover: 'text-primary' }}
      >
        <Text variant="caption" color="inherit">
          {children}
        </Text>
        <ArrowUpRight size={12} />
      </Box>
    </Link>
  )
}

function StepBody({ step, props }: { step: GoLiveStep; props: LayoutProps }) {
  const slug = props.organizationSlug
  switch (step.key) {
    case 'switch':
      return step.status === 'done' ? null : (
        <Box>
          <Button size="sm" variant="secondary" onClick={props.onOpenSwitch}>
            {props.report.pending > 0
              ? 'Continue switching'
              : 'Review what stayed'}
          </Button>
        </Box>
      )
    case 'backfill':
      return (
        <Box flexDirection="column" rowGap="m">
          <Box columnGap="s">
            <Button
              size="sm"
              onClick={() => downloadMapping(props.mapping, 'csv')}
            >
              Download ID map (CSV)
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => downloadMapping(props.mapping, 'json')}
            >
              JSON
            </Button>
          </Box>
          <IdLookup mapping={props.mapping} organizationSlug={slug} />
        </Box>
      )
    case 'polar-webhooks':
      return (
        <ExternalLink href={`/dashboard/${slug}/settings/webhooks`}>
          Manage webhook endpoints
        </ExternalLink>
      )
    case 'stripe-off':
      return (
        <Box columnGap="l">
          <ExternalLink href="https://dashboard.stripe.com/webhooks">
            Stripe webhooks
          </ExternalLink>
          <ExternalLink href="https://dashboard.stripe.com/settings/billing/automatic">
            Stripe customer emails
          </ExternalLink>
        </Box>
      )
    case 'checkout':
      return (
        <ExternalLink href={`/dashboard/${slug}/products/checkout-links`}>
          Create checkout links
        </ExternalLink>
      )
  }
}

// The page as a launch checklist: each step reads its own state where Polar
// can see it, and the merchant ticks off the ones only they can confirm.
export function GoLiveLayout(props: LayoutProps) {
  const { migrationId, organizationId, report } = props
  const [markedDone, setMarkedDone] = useState(() =>
    readMarkedDone(migrationId),
  )
  const webhooks = useListWebhooksEndpoints({
    organizationId,
    limit: 1,
    page: 1,
  })
  const checkoutLinks = useQuery({
    queryKey: ['checkout_links', { organizationId, limit: 1 }],
    queryFn: () =>
      unwrap(
        api.GET('/v1/checkout-links/', {
          params: { query: { organization_id: organizationId, limit: 1 } },
        }),
      ),
  })

  const steps = goLiveSteps({
    report,
    webhookEndpoints: webhooks.data?.pagination.total_count ?? null,
    checkoutLinks: checkoutLinks.data?.pagination.total_count ?? null,
    markedDone,
  })
  const doneCount = steps.filter((step) => step.status === 'done').length
  const toggle = (key: GoLiveKey) => {
    const next = new Set(markedDone)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    writeMarkedDone(migrationId, next)
    setMarkedDone(next)
  }

  return (
    <Box flexDirection="column" rowGap="xl" maxWidth={820}>
      <PhaseHeader {...props} />
      <Box flexDirection="column" rowGap="s">
        <Text variant="caption" color="muted" tabularNums>
          {doneCount} of {steps.length} done
        </Text>
        <Box
          height={6}
          borderRadius="full"
          backgroundColor="background-card"
          overflow="hidden"
        >
          <Box
            width={`${(doneCount / steps.length) * 100}%`}
            backgroundColor="background-inverse"
          />
        </Box>
      </Box>
      <Box as="ol" flexDirection="column" rowGap="m">
        {steps.map((step, index) => (
          <Box
            as="li"
            key={step.key}
            display="flex"
            flexDirection="column"
            rowGap="m"
            padding="l"
            borderRadius="l"
            borderWidth={1}
            borderStyle="solid"
            borderColor={
              step.status === 'attention' ? 'border-warning' : 'border-primary'
            }
            opacity={step.status === 'done' && step.key !== 'switch' ? 0.7 : 1}
          >
            <Box justifyContent="between" alignItems="start" columnGap="m">
              <Box flexDirection="column" rowGap="xs">
                <Text>
                  {index + 1}. {step.title}
                </Text>
                <Text variant="caption" color="muted">
                  {step.summary}
                </Text>
              </Box>
              <Box columnGap="s" alignItems="center" flexShrink={0}>
                {step.manual && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggle(step.key)}
                  >
                    {step.status === 'done' ? 'Undo' : 'Mark done'}
                  </Button>
                )}
                <Status
                  status={STATUS[step.status].label}
                  color={STATUS[step.status].color}
                  size="small"
                />
              </Box>
            </Box>
            {step.status !== 'done' && <StepBody step={step} props={props} />}
          </Box>
        ))}
      </Box>
    </Box>
  )
}
