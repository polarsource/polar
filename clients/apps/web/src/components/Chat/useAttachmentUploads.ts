import { UploadAbortedError } from '@/components/FileUpload/Upload'
import { useCallback, useEffect, useRef, useState } from 'react'
import { formatFileSize } from './fileUtils'
import { type ChatUploader } from './types'

export interface UploadingAttachment {
  id: string
  file: File
  preview: string | null
  status: 'uploading' | 'uploaded' | 'error'
  // Uploaded fraction of the file, 0..1.
  progress: number
  // Server-side file id, set once the upload completes.
  fileId?: string
}

// Owns the eager-upload lifecycle: files start uploading the moment they're
// added, so sending only needs the collected file ids. All policy (what's
// accepted, size/count limits, the actual transfer) comes from the uploader.
export const useAttachmentUploads = (uploader: ChatUploader) => {
  const [attachments, setAttachments] = useState<UploadingAttachment[]>([])
  const [attachmentError, setAttachmentError] = useState<string | null>(null)

  const attachmentsRef = useRef(attachments)
  // In-flight upload abort handles, keyed by attachment id.
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
      // No-op if the attachment was removed while its upload was in flight.
      setAttachments((prev) => prev.map((a) => (a.id === id ? patch(a) : a)))
    },
    [],
  )

  const addFiles = useCallback(
    (files: File[]) => {
      setAttachmentError(null)

      const accepted = files.filter(uploader.isAccepted)
      if (accepted.length < files.length) {
        setAttachmentError('Some files have an unsupported format.')
      }

      const valid = accepted.filter((file) => {
        if (file.size > uploader.maxFileSize) {
          setAttachmentError(
            `${file.name} is too large (max ${formatFileSize(
              uploader.maxFileSize,
            )}).`,
          )
          return false
        }
        return true
      })

      const room = uploader.maxFiles - attachmentsRef.current.length
      if (valid.length > room) {
        setAttachmentError(`You can attach at most ${uploader.maxFiles} files.`)
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
        const { promise, abort } = uploader.upload(entry.file, (progress) =>
          update(entry.id, (a) => ({ ...a, progress })),
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
            // Aborts are user-initiated (chip removed / unmount) — no error
            // state to show.
            if (!(error instanceof UploadAbortedError)) {
              update(entry.id, (a) => ({ ...a, status: 'error' }))
            }
          })
          .finally(() => abortsRef.current.delete(entry.id))
      }
    },
    [uploader, update],
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
