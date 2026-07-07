'use client'

import { schemas } from '@polar-sh/client'
import { Text, Button } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import { resolveInsightActionHref } from './insightActions'
import { ChevronRight } from 'lucide-react'

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
  size = 'default',
}: {
  organization: schemas['Organization']
  insight: schemas['Insight']
  /** `small` tightens spacing and typography for compact surfaces
   * (e.g. the assistant conversation's empty state). */
  size?: 'default' | 'small'
}) => {
  const action = insight.primary_action
  const actionHref = action
    ? resolveInsightActionHref(organization, action)
    : null
  const small = size === 'small'

  return (
    <Box
      as="article"
      display="flex"
      flexDirection="column"
      rowGap={small ? 'm' : 'xl'}
      height="100%"
      justifyContent="between"
    >
      <Box display="flex" flexDirection="column" rowGap={small ? 's' : 'l'}>
        <Box display="flex" alignItems="center" columnGap={small ? 's' : 'm'}>
          <div
            className={twMerge(
              'size-2 rounded-full',
              categoryColor[insight.category],
            )}
          />
          <Text variant={small ? undefined : 'body'}>
            {insight.category_label}
          </Text>
        </Box>
        <Text variant={small ? 'body' : 'heading-xxs'} as="h3" wrap="balance">
          {insight.title}
        </Text>
        <Text color="muted" variant={small ? undefined : 'body'}>
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
            <Button variant="secondary" size="sm" wrapperClassNames="gap-x-1">
              {action.label}
              <ChevronRight size={8} />
            </Button>
          </Link>
        )}
      </Box>
    </Box>
  )
}
