'use client'

import { FileAttachmentPill } from '@/components/Chat/FileAttachmentPill'
import { useFileUpload } from '@/components/FileUpload'
import { toast } from '@/components/Toast/use-toast'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import { AnimatePresence } from 'motion/react'
import { twMerge } from 'tailwind-merge'

const MAX_FILE_SIZE = 50 * 1024 * 1024

const EVIDENCE_ACCEPT = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'text/csv': ['.csv'],
  'text/plain': ['.txt'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    '.docx',
  ],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
    '.xlsx',
  ],
}

export interface DisputeEvidenceState {
  fileIds: string[]
  isUploading: boolean
}

interface Props {
  organization: schemas['Organization']
  onChange: (evidence: DisputeEvidenceState) => void
}

export const DisputeEvidenceUpload = ({ organization, onChange }: Props) => {
  const { files, getRootProps, getInputProps, isDragActive, removeFile } =
    useFileUpload<schemas['SupportCaseAttachmentFileRead']>({
      organization,
      service: 'support_case_attachment',
      accept: EVIDENCE_ACCEPT,
      maxSize: MAX_FILE_SIZE,
      initialFiles: [],
      onFilesUpdated: (updated) =>
        onChange({
          fileIds: updated
            .filter((file) => file.is_uploaded)
            .map((file) => file.id),
          isUploading: updated.some(
            (file) => file.isUploading || file.isProcessing,
          ),
        }),
      onFilesRejected: (rejections) => {
        if (rejections.length === 0) return
        toast({
          title: 'File not accepted',
          description: 'Use a PDF, image, or document under 50 MB.',
        })
      },
      onFileUploadError: (fileName) =>
        toast({
          title: 'Upload failed',
          description: `Could not upload ${fileName}. Please try again.`,
        }),
    })

  const sortedFiles = [...files].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <Box flexDirection="column" rowGap="xs">
      <div
        {...getRootProps()}
        className={twMerge(
          'flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed px-4 py-8 text-center',
          isDragActive
            ? 'dark:border-polar-600 dark:bg-polar-800 border-blue-300 bg-blue-50'
            : 'dark:border-polar-700 border-gray-200 bg-gray-50 dark:bg-transparent',
        )}
      >
        <input {...getInputProps()} />
        <p className="dark:text-polar-200 text-sm font-medium text-gray-700">
          {isDragActive ? 'Drop files here' : 'Drag & drop or click to upload'}
        </p>
        <p className="dark:text-polar-500 text-xs text-gray-500">
          PDF, images, or documents up to 50 MB
        </p>
      </div>

      {files.length > 0 && (
        <Box flexWrap="wrap" gap="s">
          <AnimatePresence initial={false}>
            {sortedFiles.map((file) => (
              <FileAttachmentPill
                key={`${file.name}-${file.size}`}
                name={file.name}
                mimeType={file.mime_type}
                status={
                  file.isUploading || file.isProcessing
                    ? 'uploading'
                    : 'uploaded'
                }
                progress={file.size ? file.uploadedBytes / file.size : 0}
                onRemove={() => removeFile(file.id)}
              />
            ))}
          </AnimatePresence>
        </Box>
      )}
    </Box>
  )
}
