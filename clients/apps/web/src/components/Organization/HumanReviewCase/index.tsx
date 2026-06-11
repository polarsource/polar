'use client'

import {
  useAppealCase,
  useReplyToAppealCase,
  useRequestHumanReview,
} from '@/hooks/queries/org'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { type ScrollFadeHandle } from '@/components/Shared/ScrollFade'
import { Loader2, Paperclip } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { MessageThread } from './MessageThread'
import { ReplyBox, type ReplyBoxHandle } from './ReplyBox'
import { useFileDrop } from './useFileDrop'
import { useUnreadTitleBadge } from './useUnreadTitleBadge'

interface Props {
  organization: schemas['Organization']
}

const HumanReviewCase = ({ organization }: Props) => {
  const { data: thread, isLoading, isError } = useAppealCase(organization.id)
  const [started, setStarted] = useState(false)
  const [sendSignal, setSendSignal] = useState(0)
  const scrollFadeRef = useRef<ScrollFadeHandle>(null)
  const [suppressMerchantAnimation, setSuppressMerchantAnimation] =
    useState(false)
  const requestReview = useRequestHumanReview(organization.id)
  const reply = useReplyToAppealCase(organization.id)
  const replyBoxRef = useRef<ReplyBoxHandle>(null)
  const { isDragging, dropHandlers } = useFileDrop((files) =>
    replyBoxRef.current?.addFiles(files),
  )
  const bandRef = useRef<HTMLDivElement>(null)
  useUnreadTitleBadge(organization.id, thread?.messages)

  useEffect(() => {
    if (started) {
      bandRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [started])

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
    <div
      ref={bandRef}
      {...(isOpen && hasCase ? dropHandlers : {})}
      className="dark:border-polar-700 dark:bg-polar-800 relative -mx-8 mt-8! -mb-8 rounded-b-2xl border-t bg-white p-8"
    >
      {isOpen && isDragging && (
        <div className="dark:border-polar-600 dark:bg-polar-800/90 dark:text-polar-50 pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-b-2xl border-2 border-dashed border-gray-300 bg-white/90 text-sm font-medium text-gray-700">
          <Paperclip className="h-4 w-4" />
          Drop to attach
        </div>
      )}
      <Box display="flex" flexDirection="column" rowGap="l">
        <Box display="flex" flexDirection="column" rowGap="xs">
          <h4 className="font-medium">Messages</h4>
          <Text variant="caption" color="muted">
            Our team usually replies within 24–48 business hours if we need
            anything further. Everything happens right here, no need to reach
            out to support, we&rsquo;ll keep you posted in this thread.
          </Text>
        </Box>
        <MessageThread
          messages={messages}
          organization={organization}
          attachments={thread?.attachments ?? []}
          scrollToBottomSignal={sendSignal}
          scrollFadeRef={scrollFadeRef}
          suppressMerchantAnimation={suppressMerchantAnimation}
        />
        {isOpen ? (
          <ReplyBox
            ref={replyBoxRef}
            organization={organization}
            isPending={hasCase ? reply.isPending : requestReview.isPending}
            mode={hasCase ? 'reply' : 'request'}
            placeholder={
              hasCase
                ? 'Write a reply…'
                : 'Tell us why your organization should be approved…'
            }
            onSend={(text, fileIds) => {
              setSuppressMerchantAnimation(
                scrollFadeRef.current?.isAtBottom() === false,
              )
              setSendSignal((s) => s + 1)
              return hasCase
                ? reply.mutateAsync({ body: text, file_ids: fileIds })
                : requestReview.mutateAsync({ reason: text })
            }}
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
