'use client'

import { Chat } from '@/components/Chat/Chat'
import { type RenderChatMessage } from '@/components/Chat/types'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { MessageAvatar } from '@/components/Organization/HumanReviewCase/MessageAvatar'
import { useUnreadTitleBadge } from '@/components/Organization/HumanReviewCase/useUnreadTitleBadge'
import { useReplySupportCase, useSupportCase } from '@/hooks/queries/support'
import { useOrganizationSSE } from '@/hooks/sse'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import React, { useCallback, useEffect, useMemo } from 'react'
import {
  supportCaseUploader,
  toChatAttachments,
  toChatMessages,
} from './supportChatAdapter'
import {
  getSupportCaseTypeMeta,
  renderSupportMessage,
} from './supportCaseTypes'

interface Props {
  organization: schemas['Organization']
  caseId: string
}

export const SupportCaseView = ({ organization, caseId }: Props) => {
  const {
    data: thread,
    isLoading,
    isError,
  } = useSupportCase(organization.id, caseId)
  const reply = useReplySupportCase(organization.id, caseId)
  useUnreadTitleBadge(organization.id, thread?.messages)

  // Real-time: refetch the thread when a new message lands for this case.
  // Polling stays on as a slow fallback for dropped SSE connections.
  const queryClient = useQueryClient()
  const emitter = useOrganizationSSE(organization.id)
  useEffect(() => {
    const onMessage = (payload: { case_id?: string }) => {
      if (payload?.case_id !== caseId) return
      queryClient.invalidateQueries({
        queryKey: ['supportCase', organization.id, caseId],
      })
      queryClient.invalidateQueries({
        queryKey: ['supportCases', organization.id],
      })
    }
    emitter.on('support_case.message', onMessage)
    return () => {
      emitter.off('support_case.message', onMessage)
    }
  }, [emitter, queryClient, organization.id, caseId])

  const messages = useMemo(() => thread?.messages ?? [], [thread])
  const messageById = useMemo(
    () => new Map(messages.map((m) => [m.id, m])),
    [messages],
  )
  const chatMessages = useMemo(() => toChatMessages(messages), [messages])
  const chatAttachments = useMemo(
    () => toChatAttachments(organization.id, caseId, thread?.attachments ?? []),
    [organization.id, caseId, thread?.attachments],
  )
  const uploader = useMemo(
    () => supportCaseUploader(organization),
    [organization],
  )
  const caseType = thread?.case.type
  const renderMessage = useCallback<RenderChatMessage>(
    (chatMessage) => {
      const message = messageById.get(chatMessage.id)
      if (!message) return undefined
      return renderSupportMessage(message, organization, caseType)
    },
    [messageById, organization, caseType],
  )
  const meta = caseType ? getSupportCaseTypeMeta(caseType) : undefined

  return (
    <DashboardBody title={null} className="min-h-0 flex-1">
      <Box
        flexDirection="column"
        rowGap="l"
        flexGrow={1}
        minHeight={0}
        alignSelf="center"
        width="100%"
        maxWidth={960}
      >
        <Box flexDirection="column" rowGap="xs">
          <Box alignItems="center" columnGap="m">
            <Text variant="heading-s" as="h1">
              {meta?.label ?? 'Support'}
            </Text>
          </Box>
          {meta?.description && (
            <Box maxWidth="80%">
              <Text variant="caption" color="muted">
                {meta.description}
              </Text>
            </Box>
          )}
        </Box>
        {isLoading ? (
          <Box justifyContent="center" paddingVertical="3xl">
            <Loader2 className="dark:text-polar-400 h-5 w-5 animate-spin text-gray-500" />
          </Box>
        ) : isError || !thread ? (
          <Box
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            paddingVertical="3xl"
          >
            <Text color="muted">This support case could not be found.</Text>
          </Box>
        ) : (
          <Chat
            messages={chatMessages}
            attachments={chatAttachments}
            isOpen={thread.is_open}
            title={null}
            fillHeight
            selfAvatar={
              <MessageAvatar organization={organization} fromMerchant />
            }
            otherAvatar={
              <MessageAvatar organization={organization} fromMerchant={false} />
            }
            renderMessage={renderMessage}
            emptyState={
              <Box
                maxWidth={320}
                flexDirection="column"
                alignItems="center"
                rowGap="xs"
                textAlign="center"
              >
                <Text color="muted">No messages yet</Text>
              </Box>
            }
            composer={{
              uploader,
              isSendPending: reply.isPending,
              minTextLength: 1,
              allowAttachments: true,
              placeholder: 'Write a reply…',
              onSend: (text, fileIds) =>
                reply.mutateAsync({ body: text, file_ids: fileIds }),
            }}
          />
        )}
      </Box>
    </DashboardBody>
  )
}
