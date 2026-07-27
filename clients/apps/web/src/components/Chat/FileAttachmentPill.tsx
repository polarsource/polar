import { Text } from '@polar-sh/orbit'
import { X } from 'lucide-react'
import { motion } from 'motion/react'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import { AttachmentIcon } from './AttachmentIcon'
import { truncateFilename } from './fileUtils'

export type FileAttachmentStatus = 'uploading' | 'uploaded' | 'error'

interface Props {
  name: string
  mimeType: string
  status: FileAttachmentStatus
  onRemove: () => void
  preview?: string | null
  progress?: number
}

export const FileAttachmentPill = ({
  name,
  mimeType,
  status,
  onRemove,
  preview,
  progress = 0,
}: Props) => (
  <motion.div
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
    <AttachmentIcon name={name} mimeType={mimeType} preview={preview} />
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
        ? `${truncateFilename(name)} — upload failed`
        : truncateFilename(name)}
    </Text>
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remove ${name}`}
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
)
