'use client'

import { formatRelativeTime } from '@/components/Timeline/TimelineItem'
import { WidgetContainer } from '@/components/Widgets/WidgetContainer'
import { formatHumanFriendlyScalar } from '@/utils/formatters'
import { formatCurrency } from '@polar-sh/currency'
import { Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Card } from '@polar-sh/ui/components/atoms/Card'
import Link from 'next/link'
import { VoidData } from './types'

const cellClassName =
  'dark:border-polar-700 border-t-0 border-r border-b border-l-0 border-gray-200'

const deployedLabel = (timestamp: string) =>
  new Date(timestamp).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

export const VoidWidgets = ({
  data,
  base,
}: {
  data: VoidData
  base: string
}) => {
  const activePlans = data.plans.reduce((sum, plan) => sum + plan.active, 0)
  const identityName = (id: string) =>
    data.identities.find((identity) => identity.id === id)?.name ?? id

  return (
    <div className="dark:border-polar-700 overflow-hidden rounded-xl border border-gray-200">
      <div className="grid grid-cols-1 [clip-path:inset(1px_1px_1px_1px)] lg:grid-cols-3">
        <WidgetContainer
          title="Definition"
          action={
            <Link href={`${base}/definition/products`}>
              <span className="dark:text-polar-500 text-gray-500">
                View definition
              </span>
            </Link>
          }
          className={cellClassName}
        >
          <div className="flex flex-col gap-y-2 pb-6">
            {data.deployments.map((deployment) => (
              <Card
                key={deployment.version}
                className="dark:bg-polar-800 flex flex-col gap-y-1 rounded-xl border-none bg-gray-50 px-4 py-4"
              >
                <div className="dark:text-polar-400 flex flex-row items-baseline justify-between text-sm text-gray-700">
                  <span>{deployedLabel(deployment.time)}</span>
                  <Status
                    status={deployment.status}
                    color={deployment.status === 'Active' ? 'green' : undefined}
                    size="small"
                  />
                </div>
                <div className="flex flex-row justify-between gap-x-4">
                  <h3>{deployment.version}</h3>
                  <span className="dark:text-polar-500 text-gray-500">
                    {deployment.hash}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </WidgetContainer>
        <WidgetContainer
          title="Event Stream"
          action={
            <span className="dark:text-polar-500 text-gray-500">
              {formatHumanFriendlyScalar(data.eventCount)} events
            </span>
          }
          className={cellClassName}
        >
          <Box flexDirection="column" paddingBottom="xl" rowGap="xs">
            {data.events.slice(0, 6).map((event) => (
              <Box
                key={event.id}
                alignItems="center"
                justifyContent="between"
                columnGap="m"
                paddingVertical="s"
              >
                <Box flexDirection="column" minWidth={0}>
                  <Text truncate>{event.name}</Text>
                  <Text color="muted" variant="caption" truncate>
                    {identityName(event.identity_id)}
                  </Text>
                </Box>
                <Text color="muted" variant="caption">
                  {formatRelativeTime(event.timestamp)}
                </Text>
              </Box>
            ))}
            <Box paddingTop="m">
              <Link href={`${base}/definition/events`}>
                <Text color="muted" variant="caption">
                  View all events
                </Text>
              </Link>
            </Box>
          </Box>
        </WidgetContainer>
        <WidgetContainer
          title="Plans"
          action={
            <span className="dark:text-polar-500 text-gray-500">
              {activePlans} active
            </span>
          }
          className={cellClassName}
        >
          <Box flexDirection="column" paddingBottom="xl" rowGap="xs">
            {data.plans.map((plan) => (
              <Box
                key={plan.name}
                alignItems="center"
                justifyContent="between"
                columnGap="m"
                paddingVertical="s"
              >
                <Box flexDirection="column" minWidth={0}>
                  <Text truncate>{plan.name}</Text>
                  <Text color="muted" variant="caption">
                    {plan.active} active
                  </Text>
                </Box>
                <Text>{formatCurrency('statistics')(plan.mrr, 'usd')}</Text>
              </Box>
            ))}
            <Box paddingTop="m">
              <Link href={`${base}/billing/subscriptions`}>
                <Text color="muted" variant="caption">
                  View subscriptions
                </Text>
              </Link>
            </Box>
          </Box>
        </WidgetContainer>
      </div>
    </div>
  )
}
