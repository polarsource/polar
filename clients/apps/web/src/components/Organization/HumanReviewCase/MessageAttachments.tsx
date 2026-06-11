import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import React from 'react'
import { attachmentDownloadUrl, type CaseAttachment } from './caseAttachments'
import { FileTypeIcon } from './FileTypeIcon'
import { formatFileSize, truncateFilename } from './fileTypes'

interface Props {
  attachments: CaseAttachment[]
  organizationId: string
  inverse: boolean
}

export const MessageAttachments = ({
  attachments,
  organizationId,
  inverse,
}: Props) => {
  if (attachments.length === 0) return null

  return (
    <Box display="flex" flexDirection="column" rowGap="xs">
      {attachments.map((attachment) => (
        <a
          key={attachment.id}
          href={attachmentDownloadUrl(organizationId, attachment.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-2"
        >
          <FileTypeIcon
            name={attachment.file.name}
            mimeType={attachment.file.mime_type}
            className={inverse ? 'dark:text-polar-600 text-white' : undefined}
          />
          <span className="group-hover:underline">
            <Text variant="caption" color={inverse ? 'inverse' : 'default'}>
              {truncateFilename(attachment.file.name)}
            </Text>
          </span>
          <Text variant="caption" color={inverse ? 'inverse' : 'muted'}>
            {formatFileSize(attachment.file.size)}
          </Text>
        </a>
      ))}
    </Box>
  )
}
