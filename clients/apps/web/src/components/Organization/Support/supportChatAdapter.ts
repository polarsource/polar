import { type ChatAttachment } from '@/components/Chat/types'
import { CONFIG } from '@/utils/config'
import { schemas } from '@polar-sh/client'
import { mapChatAttachments } from './supportCaseChat'

export { supportCaseUploader, toChatMessages } from './supportCaseChat'

export const toChatAttachments = (
  organizationId: string,
  caseId: string,
  attachments: schemas['SupportCaseAttachment'][],
): ChatAttachment[] =>
  mapChatAttachments(
    attachments,
    (attachmentId) =>
      `${CONFIG.BASE_URL}/v1/organizations/${organizationId}/support/cases/${caseId}/attachments/${attachmentId}/download`,
  )
