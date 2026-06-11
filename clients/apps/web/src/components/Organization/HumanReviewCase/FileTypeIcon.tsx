import {
  File as FileIcon,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
} from 'lucide-react'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import { getExtension } from './fileTypes'

const DEFAULT_CLASS = 'dark:text-polar-400 h-4 w-4 shrink-0 text-gray-500'

interface Props {
  name: string
  mimeType: string
  className?: string
}

export const FileTypeIcon = ({ name, mimeType, className }: Props) => {
  const cls = twMerge(DEFAULT_CLASS, className)
  const ext = getExtension(name)

  if (mimeType.startsWith('image/')) {
    return <FileImage className={cls} />
  }
  if (mimeType.startsWith('video/') || ext === 'mov') {
    return <FileVideo className={cls} />
  }
  if (mimeType.startsWith('audio/')) {
    return <FileAudio className={cls} />
  }
  if (['csv', 'xls', 'xlsx'].includes(ext) || mimeType === 'text/csv') {
    return <FileSpreadsheet className={cls} />
  }
  if (
    ext === 'pdf' ||
    ext === 'doc' ||
    ext === 'docx' ||
    mimeType === 'application/pdf' ||
    mimeType === 'application/msword'
  ) {
    return <FileText className={cls} />
  }

  return <FileIcon className={cls} />
}
