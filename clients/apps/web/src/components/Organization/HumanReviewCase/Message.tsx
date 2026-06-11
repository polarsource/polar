import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import React from 'react'
import { type CaseAttachment } from './caseAttachments'
import { ChatBubble } from './ChatBubble'
import { DecisionMessage } from './DecisionMessage'

const EVENT_LABELS: Record<string, string> = {
  info_requested: 'Information requested',
}

interface Props {
  message: schemas['SupportCaseMessage']
  organization: schemas['Organization']
  attachments?: CaseAttachment[]
  animate?: boolean
  isFirstInGroup: boolean
  isLastInGroup: boolean
}

export const Message = ({
  message,
  organization,
  attachments,
  animate = true,
  isFirstInGroup,
  isLastInGroup,
}: Props) => {
  if (message.type === 'opened' || message.type === 'closed') {
    return null
  }

  if (message.type === 'appeal_approved' || message.type === 'appeal_denied') {
    return <DecisionMessage message={message} organization={organization} />
  }

  if (message.type !== 'chat') {
    return (
      <Text variant="caption" color="muted" align="center">
        {EVENT_LABELS[message.type] ?? message.type}
        {message.body ? ` — ${message.body}` : ''}
      </Text>
    )
  }

  return (
    <ChatBubble
      message={message}
      organization={organization}
      attachments={attachments}
      animate={animate}
      isFirstInGroup={isFirstInGroup}
      isLastInGroup={isLastInGroup}
    />
  )
}
