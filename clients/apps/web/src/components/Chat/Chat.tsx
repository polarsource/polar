'use client'

import {
  type ScrollFadeHandle,
} from '@/components/Shared/ScrollFade'
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
  // The send mutation's in-flight state (uploads have their own internal
  // tracking).
  isSendPending: boolean
  uploader: ChatUploader
  placeholder?: string
  // Minimum typed-text length to allow sending; attachments are unaffected.
  minTextLength?: number
  showMinimumCharCounter?: boolean
  allowAttachments?: boolean
}

interface Props {
  messages: ChatMessage[]
  attachments?: ChatAttachment[]
  isOpen: boolean
  composer: ComposerConfig
  title?: string
  description?: React.ReactNode
  selfAvatar?: React.ReactNode
  otherAvatar?: React.ReactNode
  renderMessage?: RenderChatMessage
  closedNotice?: string
  // Bring the chat into view when it mounts (e.g. after an explicit "start a
  // conversation" action).
  scrollIntoViewOnMount?: boolean
  className?: string
}

// A complete chat surface: header, message thread, attachment drop zone and
// composer. Domain-free — data, copy, avatars, upload policy and custom
// message rendering are all injected.
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
  closedNotice = 'Chat ended',
  scrollIntoViewOnMount = false,
  className,
}: Props) => {
  const [sendSignal, setSendSignal] = useState(0)
  // Set on send when the thread was scrolled up — the 'self' message that
  // follows shouldn't animate, since we're force-scrolling to the bottom.
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
    // Mount-only by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        <Box display="flex" flexDirection="column" rowGap="xs">
          <h4 className="font-medium">{title}</h4>
          {description && (
            <Text variant="caption" color="muted">
              {description}
            </Text>
          )}
        </Box>
        <MessageThread
          messages={messages}
          attachments={attachments}
          selfAvatar={selfAvatar}
          otherAvatar={otherAvatar}
          renderMessage={renderMessage}
          scrollToBottomSignal={sendSignal}
          scrollFadeRef={scrollFadeRef}
          suppressSelfAnimation={suppressSelfAnimation}
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
              // Capture scroll position before the forced scroll below.
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
