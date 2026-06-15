import { type ChatAttachment } from '@/components/Chat/types'
import { mapChatAttachments } from '@/components/Organization/Support/supportCaseChat'
import { CONFIG } from '@/utils/config'
import { schemas } from '@polar-sh/client'

export {
  supportCaseUploader,
  toChatMessages,
} from '@/components/Organization/Support/supportCaseChat'

export const toChatAttachments = (
  organizationId: string,
  attachments: schemas['SupportCaseAttachment'][],
): ChatAttachment[] =>
  mapChatAttachments(
    attachments,
    (attachmentId) =>
      `${CONFIG.BASE_URL}/v1/organizations/${organizationId}/appeal/case/attachments/${attachmentId}/download`,
  )
