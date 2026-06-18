'use client'

import { type ScrollFadeHandle } from '@/components/Shared/ScrollFade'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Paperclip } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Composer, type ComposerHandle } from './Composer'
import { MessageThread } from './MessageThread'
import {
  type ChatAttachment,
  type ChatMessage,
  type ChatUploader,
  type RenderChatMessage,
} from './types'
import { useFileDrop } from './useFileDrop'

interface ComposerConfig {
  onSend: (text: string, fileIds: string[]) => Promise<{ error?: unknown }>
  isSendPending: boolean
  uploader: ChatUploader
  placeholder?: string
  minTextLength?: number
  showMinimumCharCounter?: boolean
  allowAttachments?: boolean
}

interface Props {
  messages: ChatMessage[]
  attachments?: ChatAttachment[]
  isOpen: boolean
  composer: ComposerConfig
  title?: string | null
  description?: React.ReactNode
  selfAvatar?: React.ReactNode
  otherAvatar?: React.ReactNode
  renderMessage?: RenderChatMessage
  emptyState?: React.ReactNode
  closedNotice?: string
  autoHeight?: boolean

  scrollIntoViewOnMount?: boolean
  className?: string
}

export const Chat = ({
  messages,
  attachments = [],
  isOpen,
  composer,
  title = 'Messages',
  description,
  selfAvatar,
  otherAvatar,
  renderMessage,
  emptyState,
  closedNotice = 'Chat ended',
  autoHeight = false,
  scrollIntoViewOnMount = false,
  className,
}: Props) => {
  const [sendSignal, setSendSignal] = useState(0)

  const [suppressSelfAnimation, setSuppressSelfAnimation] = useState(false)
  const scrollFadeRef = useRef<ScrollFadeHandle>(null)
  const composerRef = useRef<ComposerHandle>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const allowAttachments = composer.allowAttachments ?? true
  const dropEnabled = isOpen && allowAttachments
  const { isDragging, dropHandlers } = useFileDrop((files) =>
    composerRef.current?.addFiles(files),
  )

  useEffect(() => {
    if (scrollIntoViewOnMount) {
      rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [scrollIntoViewOnMount])

  return (
    <div
      ref={rootRef}
      {...(dropEnabled ? dropHandlers : {})}
      className={twMerge('relative', className)}
    >
      {dropEnabled && isDragging && (
        <div className="dark:border-polar-600 dark:bg-polar-800/90 dark:text-polar-50 pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-[inherit] border-2 border-dashed border-gray-300 bg-white/90 text-sm font-medium text-gray-700">
          <Paperclip className="h-4 w-4" />
          Drop to attach
        </div>
      )}
      <Box display="flex" flexDirection="column" rowGap="l">
        {(title !== null || description) && (
          <Box display="flex" flexDirection="column" rowGap="xs">
            {title !== null && <h4 className="font-medium">{title}</h4>}
            {description && (
              <Text variant="caption" color="muted">
                {description}
              </Text>
            )}
          </Box>
        )}
        <MessageThread
          messages={messages}
          attachments={attachments}
          selfAvatar={selfAvatar}
          otherAvatar={otherAvatar}
          renderMessage={renderMessage}
          emptyState={emptyState}
          scrollToBottomSignal={sendSignal}
          scrollFadeRef={scrollFadeRef}
          suppressSelfAnimation={suppressSelfAnimation}
          autoHeight={autoHeight}
        />
        {isOpen ? (
          <Composer
            ref={composerRef}
            uploader={composer.uploader}
            isSendPending={composer.isSendPending}
            placeholder={composer.placeholder}
            minTextLength={composer.minTextLength}
            showMinimumCharCounter={composer.showMinimumCharCounter}
            allowAttachments={allowAttachments}
            onSend={(text, fileIds) => {
              setSuppressSelfAnimation(
                scrollFadeRef.current?.isAtBottom() === false,
              )
              setSendSignal((s) => s + 1)
              return composer.onSend(text, fileIds)
            }}
          />
        ) : (
          <Text variant="caption" color="muted" align="center">
            {closedNotice}
          </Text>
        )}
      </Box>
    </div>
  )
}
