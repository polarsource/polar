import { Text } from '@polar-sh/orbit'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import { AttachmentIcon } from './AttachmentIcon'
import { truncateFilename } from './fileUtils'
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
          <motion.div
            key={id}
            layout
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ type: 'spring', stiffness: 500, damping: 32 }}
            className={twMerge(
              'dark:border-polar-700 dark:bg-polar-900 relative flex items-center gap-2 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 p-1.5 text-sm',
              status === 'error' && 'border-red-300 dark:border-red-900',
            )}
          >
            <AttachmentIcon file={file} preview={preview} />
            <Text
              variant="caption"
              color={
                status === 'error'
                  ? 'danger'
                  : status === 'uploading'
                    ? 'muted'
                    : 'default'
              }
              wrap="nowrap"
            >
              {status === 'error'
                ? `${truncateFilename(file.name)} — upload failed`
                : truncateFilename(file.name)}
            </Text>
            <button
              type="button"
              onClick={() => onRemove(id)}
              aria-label={`Remove ${file.name}`}
              className="dark:text-polar-400 dark:hover:bg-polar-800 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-600"
            >
              <X className="h-3 w-3" />
            </button>
            {status === 'uploading' && (
              <div className="dark:bg-polar-700 absolute inset-x-0 bottom-0 h-0.5 bg-gray-200">
                <div
                  className="dark:bg-polar-200 h-full bg-gray-900 transition-[width] duration-200 ease-out"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
