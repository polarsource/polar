import {
  type ChatAttachment,
  type ChatMessage,
  type ChatUploader,
} from '@/components/Chat/types'
import { getExtension } from '@/components/Chat/fileUtils'
import { Upload } from '@/components/FileUpload/Upload'
import { CONFIG } from '@/utils/config'
import { schemas } from '@polar-sh/client'

// Mirrors the exact MIME types the backend accepts.
const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'text/csv',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

const EXTENSION_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  csv: 'text/csv',
  txt: 'text/plain',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

const isAcceptedFile = (file: File): boolean => {
  if (ACCEPTED_MIME_TYPES.includes(file.type)) return true

  if (file.type === '') {
    return EXTENSION_TO_MIME[getExtension(file.name)] !== undefined
  }

  return false
}

export const supportCaseUploader = (
  organization: schemas['Organization'],
): ChatUploader => ({
  accept: [
    ...ACCEPTED_MIME_TYPES,
    ...Object.keys(EXTENSION_TO_MIME).map((ext) => `.${ext}`),
  ].join(','),
  isAccepted: isAcceptedFile,
  maxFileSize: 250 * 1024 * 1024,
  maxFiles: 10,
  upload: (file, onProgress) => {
    let upload: Upload | null = null
    const promise = new Promise<{ id: string }>((resolve, reject) => {
      upload = new Upload({
        service: 'support_case_attachment',
        organization,
        file,
        onFileProcessing: () => {},
        onFileCreate: () => {},
        onFileUploadProgress: (_file, uploaded) =>
          onProgress(Math.min(uploaded / file.size, 1)),
        onFileUploaded: resolve,
        onFileUploadError: (_fileId, error) => reject(error),
      })
      upload.run()
    })
    return { promise, abort: () => upload?.abort() }
  },
})

export const toChatMessages = (
  messages: schemas['SupportCaseMessage'][],
): ChatMessage[] =>
  messages.map((message) => ({
    id: message.id,
    body: message.body,
    createdAt: message.created_at,
    sender: message.author_kind === 'merchant' ? 'self' : 'other',
  }))

export const toChatAttachments = (
  organizationId: string,
  attachments: schemas['SupportCaseAttachment'][],
): ChatAttachment[] =>
  attachments.map((attachment) => ({
    id: attachment.id,
    messageId: attachment.message_id,
    name: attachment.file.name,
    mimeType: attachment.file.mime_type,
    size: attachment.file.size,
    href: `${CONFIG.BASE_URL}/v1/organizations/${organizationId}/appeal/case/attachments/${attachment.id}/download`,
  }))
