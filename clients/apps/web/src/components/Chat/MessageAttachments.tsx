import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import React from 'react'
import { FileTypeIcon } from './FileTypeIcon'
import { formatFileSize, truncateFilename } from './fileUtils'
import { type ChatAttachment } from './types'

interface Props {
  attachments: ChatAttachment[]
  inverse: boolean
}

const Row = ({
  attachment,
  inverse,
}: {
  attachment: ChatAttachment
  inverse: boolean
}) => {
  const content = (
    <>
      <FileTypeIcon
        name={attachment.name}
        mimeType={attachment.mimeType}
        className={inverse ? 'dark:text-polar-600 text-white' : undefined}
      />
      <span className="group-hover:underline">
        <Text variant="caption" color={inverse ? 'inverse' : 'default'}>
          {truncateFilename(attachment.name)}
        </Text>
      </span>
      <Text variant="caption" color={inverse ? 'inverse' : 'muted'}>
        {formatFileSize(attachment.size)}
      </Text>
    </>
  )

  if (!attachment.href) {
    return <div className="flex items-center gap-2">{content}</div>
  }

  return (
    <a
      href={attachment.href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-2"
    >
      {content}
    </a>
  )
}

export const MessageAttachments = ({ attachments, inverse }: Props) => {
  if (attachments.length === 0) return null

  return (
    <Box display="flex" flexDirection="column" rowGap="xs">
      {attachments.map((attachment) => (
        <Row key={attachment.id} attachment={attachment} inverse={inverse} />
      ))}
    </Box>
  )
}
