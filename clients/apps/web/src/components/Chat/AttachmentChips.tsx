import { AnimatePresence } from 'motion/react'
import React from 'react'
import { FileAttachmentPill } from './FileAttachmentPill'
import { type UploadingAttachment } from './useAttachmentUploads'

interface Props {
  attachments: UploadingAttachment[]
  onRemove: (id: string) => void
}

export const AttachmentChips = ({ attachments, onRemove }: Props) => {
  if (attachments.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 px-4 pt-4">
      <AnimatePresence initial={false}>
        {attachments.map(({ id, file, preview, status, progress }) => (
          <FileAttachmentPill
            key={id}
            name={file.name}
            mimeType={file.type}
            preview={preview}
            status={status}
            progress={progress}
            onRemove={() => onRemove(id)}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}
