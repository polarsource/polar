import {
  ScrollFade,
  type ScrollFadeHandle,
} from '@/components/Shared/ScrollFade'
import { Box } from '@polar-sh/orbit/Box'
import React, { Fragment, useEffect, useState } from 'react'
import { ChatBubble } from './ChatBubble'
import {
  type ChatAttachment,
  type ChatMessage,
  type RenderChatMessage,
} from './types'

interface Props {
  messages: ChatMessage[]
  attachments?: ChatAttachment[]
  selfAvatar?: React.ReactNode
  otherAvatar?: React.ReactNode
  renderMessage?: RenderChatMessage
  emptyState?: React.ReactNode
  scrollToBottomSignal?: number
  scrollFadeRef?: React.Ref<ScrollFadeHandle>
  suppressSelfAnimation?: boolean
}

export const MessageThread = ({
  messages,
  attachments = [],
  selfAvatar,
  otherAvatar,
  renderMessage,
  emptyState,
  scrollToBottomSignal,
  scrollFadeRef,
  suppressSelfAnimation,
}: Props) => {
  const [, setTimeTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setTimeTick((t) => t + 1), 60_000)
    return () => clearInterval(interval)
  }, [])

  const rendered = messages.map((message) => renderMessage?.(message))
  const isBubble = (index: number) =>
    index >= 0 && index < messages.length && rendered[index] === undefined
  const visibleCount = rendered.filter((r) => r !== null).length

  if (visibleCount === 0 && emptyState) {
    return (
      <div className="flex h-[420px] flex-col items-center justify-center">
        {emptyState}
      </div>
    )
  }

  return (
    <ScrollFade
      ref={scrollFadeRef}
      className="-mr-4 flex h-[420px] flex-col pr-4"
      stickToBottom
      scrollToBottomSignal={scrollToBottomSignal}
    >
      <Box
        aria-live="polite"
        display="flex"
        flexDirection="column"
        rowGap="xs"
        marginTop="auto"
      >
        {messages.map((message, index) => {
          const custom = rendered[index]
          if (custom === null) return null
          if (custom !== undefined) {
            return <Fragment key={message.id}>{custom}</Fragment>
          }

          const sameSender = (other: number) =>
            isBubble(other) && messages[other].sender === message.sender
          const animate = !(message.sender === 'self' && suppressSelfAnimation)
          return (
            <ChatBubble
              key={message.id}
              message={message}
              attachments={attachments.filter(
                (attachment) => attachment.messageId === message.id,
              )}
              avatar={message.sender === 'self' ? selfAvatar : otherAvatar}
              animate={animate}
              isFirstInGroup={!sameSender(index - 1)}
              isLastInGroup={!sameSender(index + 1)}
            />
          )
        })}
      </Box>
    </ScrollFade>
  )
}
