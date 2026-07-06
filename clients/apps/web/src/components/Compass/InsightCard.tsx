'use client'

import { schemas } from '@polar-sh/client'
import { Text, Button } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import { resolveInsightActionHref } from './insightActions'

const categoryColor: Record<schemas['InsightCategory'], string> = {
  growth: 'bg-green-500',
  product: 'bg-indigo-500',
  retention: 'bg-teal-500',
  revenue: 'bg-green-500',
  risk: 'bg-red-500',
  cost: 'bg-amber-500',
}

export const InsightCard = ({
  organization,
  insight,
}: {
  organization: schemas['Organization']
  insight: schemas['Insight']
}) => {
  const action = insight.primary_action
  const actionHref = action
    ? resolveInsightActionHref(organization, action)
    : null

  return (
    <Box
      as="article"
      display="flex"
      flexDirection="column"
      rowGap="xl"
      height="100%"
      justifyContent="between"
    >
      <Box display="flex" flexDirection="column" rowGap="l">
        <Box display="flex" alignItems="center" columnGap="m">
          <div
            className={twMerge(
              'size-2 rounded-full',
              categoryColor[insight.category],
            )}
          />
          <Text variant="body">{insight.category_label}</Text>
        </Box>
        <Text variant="heading-xxs" as="h3" wrap="balance">
          {insight.title}
        </Text>
        <Text color="muted" variant="body">
          {insight.body}
        </Text>
      </Box>

      <Box
        display="flex"
        flexDirection="row"
        flexWrap="wrap"
        alignItems="center"
        columnGap="xl"
        rowGap="s"
      >
        {action && actionHref && (
          <Link href={actionHref}>
            <Button variant="secondary" size="sm">
              {action.label}
            </Button>
          </Link>
        )}
      </Box>
    </Box>
  )
}
