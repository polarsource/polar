'use client'

import LogoIcon from '@/components/Brand/logos/LogoIcon'
import { Chat } from '@/components/Chat/Chat'
import { type ChatMessage } from '@/components/Chat/types'
import { useSupportCaseChat } from '@/components/SupportCase/useSupportCaseChat'
import { useReplyToSupportCase, useSupportCase } from '@/hooks/queries/org'
import { schemas } from '@polar-sh/client'
import { Avatar, Text } from '@polar-sh/orbit'
import { MessageCircle } from 'lucide-react'
import { useCallback } from 'react'

const EVENT_LABELS: Record<string, string> = {
  dispute_under_review: 'Evidence submitted — under review by the bank',
  dispute_won: 'Dispute won',
  dispute_lost: 'Dispute lost',
  dispute_prevented: 'Dispute prevented',
  merchant_accepted: 'You accepted the dispute',
}

const MerchantAvatar = ({
  organization,
}: {
  organization: schemas['Organization']
}) => (
  <Avatar
    name={organization.name}
    avatar_url={organization.avatar_url}
    className="h-7 w-7 text-[11px]"
  />
)

const SupportAvatar = () => (
  <div className="dark:bg-polar-50 dark:text-polar-900 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-900 text-white">
    <LogoIcon className="h-6 w-6" />
  </div>
)

export const DisputeConversation = ({
  organization,
  caseId,
  fillHeight = false,
}: {
  organization: schemas['Organization']
  caseId: string
  fillHeight?: boolean
}) => {
  const { data: thread } = useSupportCase(caseId)
  const reply = useReplyToSupportCase()

  const { messageById, chatMessages, chatAttachments, uploader } =
    useSupportCaseChat({ caseId, organization, thread })

  const renderMessage = useCallback(
    (chatMessage: ChatMessage) => {
      const message = messageById.get(chatMessage.id)
      if (!message) return undefined
      if (message.type === 'opened' || message.type === 'closed') {
        return null
      }
      if (message.type !== 'chat') {
        return (
          <Text variant="caption" color="muted" align="center">
            {EVENT_LABELS[message.type] ?? message.type}
          </Text>
        )
      }
      return undefined
    },
    [messageById],
  )

  return (
    <Chat
      title="Polar support chat"
      fillHeight={fillHeight}
      messages={chatMessages}
      attachments={chatAttachments}
      isOpen={thread?.is_open ?? true}
      selfAvatar={<MerchantAvatar organization={organization} />}
      otherAvatar={<SupportAvatar />}
      renderMessage={renderMessage}
      closedNotice="This dispute is closed."
      emptyState={
        <div className="flex max-w-xs flex-col items-center gap-2 text-center">
          <MessageCircle className="dark:text-polar-600 h-8 w-8 text-gray-300" />
          <Text color="muted">No messages yet</Text>
        </div>
      }
      className="dark:border-polar-700 rounded-2xl border border-gray-200 bg-white p-6 dark:bg-transparent"
      composer={{
        uploader,
        isSendPending: reply.isPending,
        minTextLength: 1,
        allowAttachments: true,
        placeholder: 'Write a reply…',
        onSend: (text, fileIds) =>
          reply.mutateAsync({ caseId, body: text, file_ids: fileIds }),
      }}
    />
  )
}
