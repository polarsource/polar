import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Check, X } from 'lucide-react'
import React from 'react'
import { formatDistanceToNow } from 'date-fns'

const relativeTime = (iso: string): string => {
  const date = new Date(iso)
  if (Date.now() - date.getTime() < 60_000) {
    return 'just now'
  }
  return formatDistanceToNow(date, { addSuffix: true }).replace(
    / minutes?/,
    ' min',
  )
}

const EVENT_LABELS: Record<string, string> = {
  info_requested: 'Information requested',
}

interface Props {
  message: schemas['SupportCaseMessage']
  isFirstInGroup: boolean
  isLastInGroup: boolean
}

export const Message = ({ message, isFirstInGroup, isLastInGroup }: Props) => {
  if (message.type === 'opened' || message.type === 'closed') {
    return null
  }

  if (message.type === 'appeal_approved' || message.type === 'appeal_denied') {
    const decision = message.type === 'appeal_approved' ? 'approved' : 'denied'
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="start"
        rowGap="xs"
        marginTop="s"
      >
        <Box
          display="flex"
          flexDirection="column"
          rowGap="xs"
          padding="m"
          borderRadius="l"
          borderBottomLeftRadius="none"
          maxWidth="80%"
          backgroundColor="background-card"
        >
          <Box display="flex" alignItems="center" columnGap="xs">
            {message.type === 'appeal_approved' ? (
              <Check className="h-4 w-4 shrink-0 text-emerald-500" />
            ) : (
              <X className="h-4 w-4 shrink-0 text-red-500" />
            )}
            <Text as="strong">Appeal {decision}</Text>
          </Box>
          {message.body && <Text>{message.body}</Text>}
        </Box>
        <Box>
          <Text variant="caption" color="muted">
            {relativeTime(message.created_at)}
          </Text>
        </Box>
      </Box>
    )
  }

  if (message.type !== 'chat') {
    return (
      <Text variant="caption" color="muted" align="center">
        {EVENT_LABELS[message.type] ?? message.type}
        {message.body ? ` — ${message.body}` : ''}
      </Text>
    )
  }

  const fromMerchant = message.author_kind === 'merchant'
  const senderTop = isFirstInGroup ? 'l' : 's'
  const senderBottom = isLastInGroup ? 'none' : 's'

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems={fromMerchant ? 'end' : 'start'}
      rowGap="xs"
      marginTop={isFirstInGroup ? 's' : 'none'}
    >
      <Box
        padding="m"
        borderTopLeftRadius={fromMerchant ? 'l' : senderTop}
        borderTopRightRadius={fromMerchant ? senderTop : 'l'}
        borderBottomLeftRadius={fromMerchant ? 'l' : senderBottom}
        borderBottomRightRadius={fromMerchant ? senderBottom : 'l'}
        maxWidth="80%"
        backgroundColor={
          fromMerchant ? 'background-inverse' : 'background-card'
        }
      >
        <Text color={fromMerchant ? 'inverse' : 'default'}>{message.body}</Text>
      </Box>
      {isLastInGroup && (
        <Box>
          <Text variant="caption" color="muted">
            {relativeTime(message.created_at)}
          </Text>
        </Box>
      )}
    </Box>
  )
}
