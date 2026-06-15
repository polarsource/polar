import { DecisionMessage } from '@/components/Organization/HumanReviewCase/DecisionMessage'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import React from 'react'

type SupportCaseType = schemas['SupportCaseType']
type SupportCaseMessage = schemas['SupportCaseMessage']
type Organization = schemas['Organization']

interface SupportCaseTypeMeta {
  label: string
  description?: string

  renderActionMessage?: (
    message: SupportCaseMessage,
    organization: Organization,
  ) => React.ReactNode | null | undefined
}

const humanize = (type: string): string =>
  type.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

const REGISTRY: Partial<Record<SupportCaseType, SupportCaseTypeMeta>> = {
  review_appeal: {
    label: 'Account review',
    description:
      "Account reviews are handled directly in-app, so reaching out to support won't speed up the process or provide additional status updates while the review is underway. Thanks for your patience.",
    renderActionMessage: (message, organization) => {
      if (
        message.type === 'appeal_approved' ||
        message.type === 'appeal_denied'
      ) {
        return <DecisionMessage message={message} organization={organization} />
      }
      if (message.type === 'info_requested') {
        return (
          <Text variant="caption" color="muted" align="center">
            Information requested{message.body ? ` — ${message.body}` : ''}
          </Text>
        )
      }
      return undefined
    },
  },
}

export const getSupportCaseTypeMeta = (
  type: SupportCaseType,
): SupportCaseTypeMeta => REGISTRY[type] ?? { label: humanize(type) }

const LIFECYCLE_HIDDEN = new Set<string>([
  'opened',
  'closed',
  'assigned',
  'released',
])

export const renderSupportMessage = (
  message: SupportCaseMessage,
  organization: Organization,
  caseType: SupportCaseType | undefined,
): React.ReactNode | null | undefined => {
  if (message.type === 'chat') return undefined

  const meta = caseType ? getSupportCaseTypeMeta(caseType) : undefined
  const action = meta?.renderActionMessage?.(message, organization)
  if (action !== undefined) return action

  if (LIFECYCLE_HIDDEN.has(message.type)) return null

  return (
    <Text variant="caption" color="muted" align="center">
      {humanize(message.type)}
      {message.body ? ` — ${message.body}` : ''}
    </Text>
  )
}
