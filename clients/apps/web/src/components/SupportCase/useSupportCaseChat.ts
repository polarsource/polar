import { schemas } from '@polar-sh/client'
import { useMemo } from 'react'
import {
  supportCaseUploader,
  toChatAttachments,
  toChatMessages,
} from './chatAdapter'

export const useSupportCaseChat = ({
  caseId,
  organization,
  thread,
}: {
  caseId: string | undefined
  organization: schemas['Organization']
  thread: schemas['SupportCaseThread'] | undefined
}) => {
  const messages = useMemo(() => thread?.messages ?? [], [thread])
  const messageById = useMemo(
    () => new Map(messages.map((message) => [message.id, message])),
    [messages],
  )
  const chatMessages = useMemo(() => toChatMessages(messages), [messages])
  const chatAttachments = useMemo(
    () => toChatAttachments(caseId, thread?.attachments ?? []),
    [caseId, thread?.attachments],
  )
  const uploader = useMemo(
    () => supportCaseUploader(organization),
    [organization],
  )

  return { messages, messageById, chatMessages, chatAttachments, uploader }
}
