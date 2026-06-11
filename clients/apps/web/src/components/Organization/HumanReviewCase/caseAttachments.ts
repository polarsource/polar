import { type FileRead, Upload } from '@/components/FileUpload/Upload'
import { CONFIG } from '@/utils/config'
import { schemas } from '@polar-sh/client'

export type CaseAttachment = schemas['SupportCaseAttachment']

export const attachmentsForMessage = (
  attachments: CaseAttachment[],
  messageId: string,
): CaseAttachment[] =>
  attachments.filter((attachment) => attachment.message_id === messageId)

export const attachmentDownloadUrl = (
  organizationId: string,
  attachmentId: string,
): string =>
  `${CONFIG.BASE_URL}/v1/organizations/${organizationId}/appeal/case/attachments/${attachmentId}/download`

export interface CaseAttachmentUpload {
  promise: Promise<FileRead>
  abort: () => void
}

export const uploadCaseAttachment = (
  organization: schemas['Organization'],
  file: File,
  onProgress?: (fraction: number) => void,
): CaseAttachmentUpload => {
  let upload: Upload | null = null
  const promise = new Promise<FileRead>((resolve, reject) => {
    upload = new Upload({
      service: 'support_case_attachment',
      organization,
      file,
      onFileProcessing: () => {},
      onFileCreate: () => {},
      onFileUploadProgress: (_file, uploaded) =>
        onProgress?.(Math.min(uploaded / file.size, 1)),
      onFileUploaded: resolve,
      onFileUploadError: (_fileId, error) => reject(error),
    })
    upload.run()
  })
  return { promise, abort: () => upload?.abort() }
}
