import React from 'react'
import { FileTypeIcon } from './FileTypeIcon'

interface Props {
  file: File
  preview: string | null
}

export const AttachmentIcon = ({ file, preview }: Props) => {
  if (file.type.startsWith('image/') && preview) {
    return (
      <div
        className="dark:bg-polar-700 h-5 w-5 shrink-0 rounded-sm bg-gray-100 bg-cover bg-center"
        style={{ backgroundImage: `url("${preview}")` }}
      />
    )
  }

  return <FileTypeIcon name={file.name} mimeType={file.type} />
}
