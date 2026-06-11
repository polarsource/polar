'use client'

import {
  useAppealCase,
  useReplyToAppealCase,
  useRequestHumanReview,
} from '@/hooks/queries/org'
import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Textarea } from '@polar-sh/orbit/ui/textarea'
import { Loader2 } from 'lucide-react'
import React, { useState } from 'react'

const EVENT_LABELS: Record<string, string> = {
  opened: 'Requested human review',
  closed: 'Case closed',
  appeal_approved: 'Appeal approved',
  appeal_denied: 'Appeal denied',
  info_requested: 'Information requested',
}

const authorLabel = (kind: schemas['SupportCaseMessageAuthorKind']): string => {
  switch (kind) {
    case 'merchant':
      return 'You'
    case 'platform':
      return 'Polar Support'
    default:
      return 'System'
  }
}

const RequestForm: React.FC<{ organizationId: string }> = ({
  organizationId,
}) => {
  const [showForm, setShowForm] = useState(false)
  const [reason, setReason] = useState('')
  const mutation = useRequestHumanReview(organizationId)

  const count = reason.length
  const isValid = count >= 50 && count <= 5000

  if (!showForm) {
    return (
      <Text color="muted">
        Still believe this is wrong?{' '}
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="cursor-pointer underline hover:no-underline"
        >
          Ask for human review
        </button>
        .
      </Text>
    )
  }

  return (
    <Box
      as="form"
      display="flex"
      flexDirection="column"
      rowGap="m"
      onSubmit={(e: React.FormEvent) => {
        e.preventDefault()
        if (isValid) mutation.mutate({ reason })
      }}
    >
      <Text variant="label">
        Tell our team why your organization should be approved
      </Text>
      <Textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="dark:bg-polar-800 min-h-32 w-full bg-white"
        placeholder="Add any context about your business that a human reviewer should know…"
        maxLength={5000}
      />
      <Box display="flex" justifyContent="between">
        <Text variant="caption" color={count > 5000 ? 'danger' : 'muted'}>
          Minimum 50 characters
        </Text>
        <Text variant="caption" color={count > 5000 ? 'danger' : 'muted'}>
          {count}/5000
        </Text>
      </Box>
      <Box display="flex" justifyContent="end" columnGap="m">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setShowForm(false)}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={!isValid || mutation.isPending}>
          {mutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Submit request
        </Button>
      </Box>
    </Box>
  )
}

const Message: React.FC<{ message: schemas['SupportCaseMessage'] }> = ({
  message,
}) => {
  if (message.type !== 'chat') {
    return (
      <Text variant="caption" color="muted" align="center">
        {EVENT_LABELS[message.type] ?? message.type}
        {message.body ? ` — ${message.body}` : ''}
      </Text>
    )
  }

  const fromMerchant = message.author_kind === 'merchant'
  return (
    <Box
      display="flex"
      flexDirection="column"
      rowGap="xs"
      padding="m"
      borderRadius="m"
      backgroundColor={
        fromMerchant ? 'background-secondary' : 'background-card'
      }
    >
      <Text variant="label">{authorLabel(message.author_kind)}</Text>
      <Text>{message.body}</Text>
    </Box>
  )
}

const ReplyBox: React.FC<{ organizationId: string }> = ({ organizationId }) => {
  const [body, setBody] = useState('')
  const mutation = useReplyToAppealCase(organizationId)

  const submit = async () => {
    if (body.trim().length === 0) return
    const result = await mutation.mutateAsync({ body })
    if (!result.error) setBody('')
  }

  return (
    <Box display="flex" flexDirection="column" rowGap="m">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="dark:bg-polar-800 min-h-24 w-full bg-white"
        placeholder="Write a reply…"
        maxLength={5000}
      />
      <Box display="flex" justifyContent="end">
        <Button
          type="button"
          onClick={submit}
          disabled={body.trim().length === 0 || mutation.isPending}
        >
          {mutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Send
        </Button>
      </Box>
    </Box>
  )
}

interface HumanReviewCaseProps {
  organization: schemas['Organization']
}

const HumanReviewCase: React.FC<HumanReviewCaseProps> = ({ organization }) => {
  const { data: thread, isLoading, isError } = useAppealCase(organization.id)

  if (isLoading) {
    return (
      <Loader2 className="dark:text-polar-400 h-4 w-4 animate-spin text-gray-500" />
    )
  }

  if (isError || !thread) {
    return <RequestForm organizationId={organization.id} />
  }

  return (
    <Box display="flex" flexDirection="column" rowGap="l">
      <Box display="flex" flexDirection="column" rowGap="m">
        {thread.messages.map((message) => (
          <Message key={message.id} message={message} />
        ))}
      </Box>
      {thread.is_open ? (
        <ReplyBox organizationId={organization.id} />
      ) : (
        <Text variant="caption" color="muted">
          This case is closed.
        </Text>
      )}
    </Box>
  )
}

export default HumanReviewCase
