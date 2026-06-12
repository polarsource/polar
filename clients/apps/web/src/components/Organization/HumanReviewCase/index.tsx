'use client'

import {
  useAppealCase,
  useReplyToAppealCase,
  useRequestHumanReview,
} from '@/hooks/queries/org'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Loader2 } from 'lucide-react'
import React, { useState } from 'react'
import { MessageThread } from './MessageThread'
import { ReplyBox } from './ReplyBox'

interface Props {
  organization: schemas['Organization']
}

const HumanReviewCase = ({ organization }: Props) => {
  const { data: thread, isLoading, isError } = useAppealCase(organization.id)
  const [started, setStarted] = useState(false)
  const requestReview = useRequestHumanReview(organization.id)
  const reply = useReplyToAppealCase(organization.id)

  if (isLoading && !started) {
    return (
      <Loader2 className="dark:text-polar-400 h-4 w-4 animate-spin text-gray-500" />
    )
  }

  const hasCase = !isError && !!thread

  if (!hasCase && !started) {
    return (
      <Text color="muted">
        Still believe this is wrong?{' '}
        <button
          type="button"
          onClick={() => setStarted(true)}
          className="cursor-pointer underline hover:no-underline"
        >
          Ask for human review
        </button>
        .
      </Text>
    )
  }

  const messages = thread?.messages ?? []
  const isOpen = thread?.is_open ?? true

  return (
    <div className="dark:border-polar-700 dark:bg-polar-800 -mx-8 mt-8! -mb-8 rounded-b-2xl border-t bg-white p-8">
      <Box display="flex" flexDirection="column" rowGap="l">
        <Box display="flex" flexDirection="column" rowGap="xs">
          <h4 className="font-medium">Messages</h4>
          <Text variant="caption" color="muted">
            Our team usually replies within 24–48 business hours if we need
            anything further. Everything happens right here, no need to reach
            out to support, we&rsquo;ll keep you posted in this thread.
          </Text>
        </Box>
        {messages.length > 0 && <MessageThread messages={messages} />}
        {isOpen ? (
          <ReplyBox
            isPending={hasCase ? reply.isPending : requestReview.isPending}
            minLength={hasCase ? 1 : 50}
            placeholder={
              hasCase
                ? 'Write a reply…'
                : 'Tell us why your organization should be approved…'
            }
            onSend={(text) =>
              hasCase
                ? reply.mutateAsync({ body: text })
                : requestReview.mutateAsync({ reason: text })
            }
          />
        ) : (
          <Text variant="caption" color="muted" align="center">
            Chat ended
          </Text>
        )}
      </Box>
    </div>
  )
}

export default HumanReviewCase
