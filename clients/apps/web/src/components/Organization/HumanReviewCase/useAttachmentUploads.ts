import { UploadAbortedError } from '@/components/FileUpload/Upload'
import { schemas } from '@polar-sh/client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { uploadCaseAttachment } from './caseAttachments'
import { isAcceptedFile } from './fileTypes'

const MAX_FILE_SIZE = 250 * 1024 * 1024
const MAX_FILES = 10

export interface UploadingAttachment {
  id: string
  file: File
  preview: string | null
  status: 'uploading' | 'uploaded' | 'error'
  progress: number
  fileId?: string
}

export const useAttachmentUploads = (organization: schemas['Organization']) => {
  const [attachments, setAttachments] = useState<UploadingAttachment[]>([])
  const [attachmentError, setAttachmentError] = useState<string | null>(null)

  const attachmentsRef = useRef(attachments)
  const abortsRef = useRef(new Map<string, () => void>())

  useEffect(() => {
    attachmentsRef.current = attachments
  }, [attachments])

  useEffect(
    () => () => {
      abortsRef.current.forEach((abort) => abort())
      attachmentsRef.current.forEach(({ preview }) => {
        if (preview) URL.revokeObjectURL(preview)
      })
    },
    [],
  )

  const update = useCallback(
    (id: string, patch: (a: UploadingAttachment) => UploadingAttachment) => {
      setAttachments((prev) => prev.map((a) => (a.id === id ? patch(a) : a)))
    },
    [],
  )

  const addFiles = useCallback(
    (files: File[]) => {
      setAttachmentError(null)

      const accepted = files.filter(isAcceptedFile)
      if (accepted.length < files.length) {
        setAttachmentError('Some files have an unsupported format.')
      }

      const valid = accepted.filter((file) => {
        if (file.size > MAX_FILE_SIZE) {
          setAttachmentError(`${file.name} is too large (max 250 MB).`)
          return false
        }
        return true
      })

      const room = MAX_FILES - attachmentsRef.current.length
      if (valid.length > room) {
        setAttachmentError(`You can attach at most ${MAX_FILES} files.`)
      }
      const toAdd = valid.slice(0, Math.max(room, 0))
      if (toAdd.length === 0) return

      const entries = toAdd.map<UploadingAttachment>((file) => ({
        id: crypto.randomUUID(),
        file,
        preview: file.type.startsWith('image/')
          ? URL.createObjectURL(file)
          : null,
        status: 'uploading',
        progress: 0,
      }))
      setAttachments((prev) => [...prev, ...entries])

      for (const entry of entries) {
        const { promise, abort } = uploadCaseAttachment(
          organization,
          entry.file,
          (progress) => update(entry.id, (a) => ({ ...a, progress })),
        )
        abortsRef.current.set(entry.id, abort)
        promise
          .then((file) =>
            update(entry.id, (a) => ({
              ...a,
              status: 'uploaded',
              progress: 1,
              fileId: file.id,
            })),
          )
          .catch((error) => {
            if (!(error instanceof UploadAbortedError)) {
              update(entry.id, (a) => ({ ...a, status: 'error' }))
            }
          })
          .finally(() => abortsRef.current.delete(entry.id))
      }
    },
    [organization, update],
  )

  const removeAttachment = useCallback((id: string) => {
    setAttachmentError(null)
    abortsRef.current.get(id)?.()
    abortsRef.current.delete(id)
    setAttachments((prev) => {
      const removed = prev.find((a) => a.id === id)
      if (removed?.preview) URL.revokeObjectURL(removed.preview)
      return prev.filter((a) => a.id !== id)
    })
  }, [])

  const clearAttachments = useCallback(() => {
    abortsRef.current.forEach((abort) => abort())
    abortsRef.current.clear()
    setAttachments((prev) => {
      prev.forEach(({ preview }) => {
        if (preview) URL.revokeObjectURL(preview)
      })
      return []
    })
  }, [])

  return {
    attachments,
    attachmentError,
    addFiles,
    removeAttachment,
    clearAttachments,
    uploadsPending: attachments.some((a) => a.status === 'uploading'),
    uploadsFailed: attachments.some((a) => a.status === 'error'),
    uploadedFileIds: attachments
      .filter((a) => a.status === 'uploaded' && a.fileId)
      .map((a) => a.fileId as string),
  }
}
