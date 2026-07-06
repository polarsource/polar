'use client'

import { schemas } from '@polar-sh/client'
import { Text, Button } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'

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
  onFeedback,
}: {
  organization: schemas['Organization']
  insight: schemas['Insight']
  onFeedback: (action: schemas['InsightFeedbackAction']) => void
}) => {
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
        <Text color="muted">{insight.body}</Text>
      </Box>

      <Box
        display="flex"
        flexDirection="row"
        flexWrap="wrap"
        alignItems="center"
        columnGap="xl"
        rowGap="s"
      >
        {insight.primary_action && (
          <Link
            href={`/dashboard/${organization.slug}/${insight.primary_action.href}`}
          >
            <Button variant="secondary" size="sm">
              {insight.primary_action.label}
            </Button>
          </Link>
        )}
        <button
          type="button"
          onClick={() => onFeedback('dismiss')}
          className="dark:hover:text-polar-200 cursor-pointer bg-transparent p-0 text-xs text-gray-500 hover:text-gray-700"
        >
          Dismiss
        </button>
        {insight.rejectable && (
          <button
            type="button"
            onClick={() => onFeedback('not_useful')}
            className="dark:hover:text-polar-200 cursor-pointer bg-transparent p-0 text-xs text-gray-500 hover:text-gray-700"
          >
            Not useful
          </button>
        )}
      </Box>
    </Box>
  )
}
