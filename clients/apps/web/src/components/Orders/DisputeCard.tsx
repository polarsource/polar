'use client'

import { Chat } from '@/components/Chat/Chat'
import {
  type ChatAttachment,
  type RenderChatMessage,
} from '@/components/Chat/types'
import { MessageAvatar } from '@/components/Organization/HumanReviewCase/MessageAvatar'
import {
  supportCaseUploader,
  toChatMessages,
} from '@/components/Organization/HumanReviewCase/chatAdapter'
import { useCase, useReplyToCase } from '@/hooks/queries/cases'
import { CONFIG } from '@/utils/config'
import {
  DisputeStatusDisplayColor,
  DisputeStatusDisplayTitle,
} from '@/utils/dispute'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Loader2 } from 'lucide-react'
import React, { useCallback, useMemo } from 'react'

// System milestones shown as a centered caption rather than a chat bubble.
const EVENT_CAPTIONS: Record<string, string> = {
  dispute_under_review:
    'Evidence submitted — the bank is reviewing the dispute.',
  dispute_won: 'Dispute won.',
  dispute_lost: 'Dispute lost.',
}
const HIDDEN_EVENTS = new Set(['opened', 'closed', 'assigned', 'released'])

// 'product_not_received' -> 'Product not received'
const humanizeReason = (reason: string): string =>
  reason.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { dateStyle: 'long' })

const toCaseAttachments = (
  caseId: string,
  attachments: schemas['SupportCaseAttachment'][],
): ChatAttachment[] =>
  attachments.map((attachment) => ({
    id: attachment.id,
    messageId: attachment.message_id,
    name: attachment.file.name,
    mimeType: attachment.file.mime_type,
    size: attachment.file.size,
    href: `${CONFIG.BASE_URL}/v1/cases/${caseId}/attachments/${attachment.id}/download`,
  }))

interface Props {
  organization: schemas['Organization']
  dispute: schemas['Dispute']
}

export const DisputeCard = ({ organization, dispute }: Props) => {
  const caseId = dispute.support_case_id ?? ''
  const { data: thread, isLoading } = useCase(caseId)
  const reply = useReplyToCase(caseId)

  const messages = useMemo(() => thread?.messages ?? [], [thread])
  const messageById = useMemo(
    () => new Map(messages.map((m) => [m.id, m])),
    [messages],
  )
  const chatMessages = useMemo(() => toChatMessages(messages), [messages])
  const chatAttachments = useMemo(
    () => toCaseAttachments(caseId, thread?.attachments ?? []),
    [caseId, thread?.attachments],
  )
  const uploader = useMemo(
    () => supportCaseUploader(organization),
    [organization],
  )

  const renderMessage = useCallback<RenderChatMessage>(
    (chatMessage) => {
      const message = messageById.get(chatMessage.id)
      if (!message) return undefined
      if (message.type === 'chat') return undefined
      if (HIDDEN_EVENTS.has(message.type)) return null
      return (
        <Text
          variant="caption"
          color={message.type === 'dispute_lost' ? 'danger' : 'muted'}
          align="center"
        >
          {EVENT_CAPTIONS[message.type] ?? message.type}
        </Text>
      )
    },
    [messageById],
  )

  return (
    <Box
      flexDirection="column"
      borderRadius="l"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      overflow="hidden"
    >
      <Box
        alignItems="center"
        justifyContent="between"
        columnGap="l"
        padding="l"
      >
        <Box flexDirection="column" rowGap="xs" minWidth={0}>
          <Text>
            {formatCurrency('standard')(dispute.amount, dispute.currency)}{' '}
            dispute
          </Text>
          <Box alignItems="center" columnGap="xs" flexWrap="wrap">
            <Text variant="caption" color="muted" as="span">
              {dispute.reason ? `${humanizeReason(dispute.reason)} · ` : ''}
              Opened {formatDate(dispute.created_at)}
            </Text>
            {dispute.status === 'needs_response' && dispute.evidence_due_by && (
              <>
                <Text variant="caption" color="muted" as="span">
                  ·
                </Text>
                <Text
                  variant="caption"
                  color={dispute.past_due ? 'danger' : 'default'}
                  as="span"
                >
                  {dispute.past_due ? 'Overdue —' : 'Respond by'}{' '}
                  {formatDate(dispute.evidence_due_by)}
                </Text>
              </>
            )}
          </Box>
        </Box>
        <Status
          color={DisputeStatusDisplayColor[dispute.status]}
          status={DisputeStatusDisplayTitle[dispute.status]}
        />
      </Box>

      {dispute.support_case_id && (
        <Box
          padding="l"
          borderTopWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
        >
          {isLoading ? (
            <Box justifyContent="center" paddingVertical="xl">
              <Loader2 className="dark:text-polar-400 h-4 w-4 animate-spin text-gray-500" />
            </Box>
          ) : thread ? (
            <Chat
              messages={chatMessages}
              attachments={chatAttachments}
              isOpen={thread.is_open}
              title="Messages"
              description="Message Polar's support team about this dispute. Attach any evidence here."
              selfAvatar={
                <MessageAvatar organization={organization} fromMerchant />
              }
              otherAvatar={
                <MessageAvatar
                  organization={organization}
                  fromMerchant={false}
                />
              }
              renderMessage={renderMessage}
              emptyState={<Text color="muted">No messages yet.</Text>}
              className="w-full"
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
          ) : null}
        </Box>
      )}
    </Box>
  )
}
