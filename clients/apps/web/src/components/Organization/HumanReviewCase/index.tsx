'use client'

import { Chat } from '@/components/Chat/Chat'
import { type ChatMessage } from '@/components/Chat/types'
import {
  useOrganizationReviewStatus,
  useReplyToSupportCase,
  useRequestHumanReview,
  useSupportCase,
} from '@/hooks/queries/org'
import { useOrganizationSSE } from '@/hooks/sse'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, MessageCircle } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'
import { useSupportCaseChat } from '@/components/SupportCase/useSupportCaseChat'
import { DecisionMessage } from './DecisionMessage'
import { MessageAvatar } from './MessageAvatar'
import { useUnreadTitleBadge } from './useUnreadTitleBadge'

const EVENT_LABELS: Record<string, string> = {
  info_requested: 'Information requested',
}

interface Props {
  organization: schemas['Organization']
}

const HumanReviewCase = ({ organization }: Props) => {
  const { data: reviewStatus, isLoading: statusLoading } =
    useOrganizationReviewStatus(organization.id)
  const caseId = reviewStatus?.appeal_case_id ?? undefined
  const { data: thread, isLoading: threadLoading } = useSupportCase(caseId)
  const isLoading = statusLoading || (!!caseId && threadLoading)
  const [started, setStarted] = useState(false)
  const requestReview = useRequestHumanReview(organization.id)
  const reply = useReplyToSupportCase()
  useUnreadTitleBadge(organization.id, thread?.messages)

  const queryClient = useQueryClient()
  const eventEmitter = useOrganizationSSE(organization.id)
  useEffect(() => {
    const handler = () => {
      queryClient.invalidateQueries({
        queryKey: ['organizationReviewStatus', organization.id],
      })
      if (caseId) {
        queryClient.invalidateQueries({ queryKey: ['supportCase', caseId] })
      }
    }
    eventEmitter.on('appeal_case.updated', handler)
    return () => {
      eventEmitter.off('appeal_case.updated', handler)
    }
  }, [eventEmitter, queryClient, organization.id, caseId])

  const { messageById, chatMessages, chatAttachments, uploader } =
    useSupportCaseChat({ caseId, organization, thread })

  const renderMessage = useCallback(
    (chatMessage: ChatMessage) => {
      const message = messageById.get(chatMessage.id)
      if (!message) return undefined
      if (message.type === 'opened' || message.type === 'closed') {
        return null
      }
      if (
        message.type === 'appeal_approved' ||
        message.type === 'appeal_denied'
      ) {
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
      return undefined
    },
    [messageById, organization],
  )

  if (isLoading && !started) {
    return (
      <Loader2 className="dark:text-polar-400 h-4 w-4 animate-spin text-gray-500" />
    )
  }

  const hasCase = !!caseId

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

  return (
    <Chat
      messages={chatMessages}
      attachments={chatAttachments}
      isOpen={thread?.is_open ?? true}
      description="Account reviews are handled directly in-app, so reaching out to support won't speed up the process or provide additional status updates while the review is underway. Thanks for your patience."
      selfAvatar={<MessageAvatar organization={organization} fromMerchant />}
      otherAvatar={
        <MessageAvatar organization={organization} fromMerchant={false} />
      }
      renderMessage={renderMessage}
      emptyState={
        <div className="flex max-w-xs flex-col items-center gap-2 text-center">
          <MessageCircle className="dark:text-polar-600 h-8 w-8 text-gray-300" />
          <Text color="muted">Start the conversation</Text>
          <Text variant="caption" color="muted" align="center">
            Share any details you think we should take into account. Our team
            will take a look.
          </Text>
        </div>
      }
      scrollIntoViewOnMount={started}
      className="dark:border-polar-700 dark:bg-polar-800 -mx-8 mt-8! -mb-8 rounded-b-2xl border-t bg-white p-8"
      composer={{
        uploader,
        isSendPending: hasCase ? reply.isPending : requestReview.isPending,
        minTextLength: hasCase ? 1 : 50,
        showMinimumCharCounter: !hasCase,
        allowAttachments: hasCase,
        placeholder: hasCase
          ? 'Write a reply…'
          : 'Tell us why your organization should be approved…',
        onSend: (text, fileIds) =>
          caseId
            ? reply.mutateAsync({ caseId, body: text, file_ids: fileIds })
            : requestReview.mutateAsync({ reason: text }),
      }}
    />
  )
}

export default HumanReviewCase
