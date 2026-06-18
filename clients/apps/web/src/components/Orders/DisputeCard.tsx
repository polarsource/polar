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
import { getDisputeReasonDescription } from '@/utils/dispute'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Flag, Loader2 } from 'lucide-react'
import React, { useCallback, useMemo } from 'react'

// System milestones shown as a centered caption rather than a chat bubble.
const EVENT_CAPTIONS: Record<string, string> = {
  dispute_under_review:
    'Evidence submitted — the bank is reviewing the dispute.',
  dispute_won: 'Dispute won.',
  dispute_lost: 'Dispute lost.',
}
const HIDDEN_EVENTS = new Set(['opened', 'closed', 'assigned', 'released'])

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })

const renderDisputeExplanation = (
  dispute: schemas['Dispute'],
): React.ReactNode => {
  const reason = dispute.reason ? (
    <Text as="span" variant="label" color="default">
      {getDisputeReasonDescription(dispute.reason)}
    </Text>
  ) : null

  switch (dispute.status) {
    case 'needs_response':
      return reason ? (
        <>
          The customer disputed this payment with their bank, citing {reason}.
          Reply with evidence to contest the dispute.
        </>
      ) : (
        <>
          The customer disputed this payment with their bank. Reply with
          evidence to contest the dispute.
        </>
      )
    case 'under_review':
      return reason ? (
        <>
          The customer disputed this payment, citing {reason}. The bank is now
          reviewing the evidence and will decide the outcome.
        </>
      ) : (
        <>
          The bank is reviewing the evidence and will decide the outcome of this
          dispute.
        </>
      )
    case 'won':
      return (
        <>
          This dispute was resolved in your favor — the funds were returned to
          your balance.
        </>
      )
    case 'lost':
      return (
        <>
          This dispute was resolved in the customer&apos;s favor — the amount
          and any fees were deducted from your balance.
        </>
      )
    case 'prevented':
      return (
        <>
          This payment was refunded before the dispute escalated, so no dispute
          fees applied.
        </>
      )
    case 'early_warning':
      return reason ? (
        <>
          The card network flagged a possible dispute, citing {reason}. No
          action is required yet.
        </>
      ) : (
        <>
          The card network flagged a possible dispute on this payment. No action
          is required yet.
        </>
      )
  }
}

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
      backgroundColor="background-primary"
      overflow="hidden"
    >
      <Box alignItems="start" columnGap="m" padding="l">
        <Box
          width={36}
          height={36}
          borderRadius="full"
          backgroundColor="background-secondary"
          color="text-primary"
          alignItems="center"
          justifyContent="center"
          flexShrink={0}
        >
          <Flag className="h-[18px] w-[18px]" />
        </Box>
        <Box flexDirection="column" rowGap="xs" minWidth={0}>
          <Text>
            Dispute ·{' '}
            {formatCurrency('standard')(dispute.amount, dispute.currency)}
          </Text>
          <Box alignItems="center" columnGap="xs" flexWrap="wrap">
            <Text variant="caption" color="muted" as="span">
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
          <Text variant="caption" color="muted">
            {renderDisputeExplanation(dispute)}
          </Text>
        </Box>
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
              title={null}
              autoHeight
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
              emptyState={
                <Text color="muted" align="center">
                  No messages yet — message Polar&apos;s support team and attach
                  any evidence here.
                </Text>
              }
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
