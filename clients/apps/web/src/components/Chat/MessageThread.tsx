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
  scrollToBottomSignal?: number
  scrollFadeRef?: React.Ref<ScrollFadeHandle>
  // When true at the moment a 'self' message mounts, its entrance animation is
  // skipped (the send jumped the view to the bottom, so animating is
  // distracting).
  suppressSelfAnimation?: boolean
}

export const MessageThread = ({
  messages,
  attachments = [],
  selfAvatar,
  otherAvatar,
  renderMessage,
  scrollToBottomSignal,
  scrollFadeRef,
  suppressSelfAnimation,
}: Props) => {
  // Re-render once a minute so relative timestamps ("5 min ago") stay current
  // even when no new data arrives.
  const [, setTimeTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setTimeTick((t) => t + 1), 60_000)
    return () => clearInterval(interval)
  }, [])

  // Custom render results, computed up front so grouping can tell which
  // neighbors are default bubbles (`undefined`) vs custom rows or hidden
  // messages.
  const rendered = messages.map((message) => renderMessage?.(message))
  const isBubble = (index: number) =>
    index >= 0 && index < messages.length && rendered[index] === undefined

  return (
    <ScrollFade
      ref={scrollFadeRef}
      // The negative margin and padding cancel out, so the content keeps its
      // exact position — but the viewport (and its overlay scrollbar) extends
      // into the container's gutter, keeping the bar off the bubbles.
      className="-mr-4 flex h-[420px] flex-col pr-4"
      stickToBottom
      scrollToBottomSignal={scrollToBottomSignal}
    >
      {/* marginTop auto pins a short conversation to the bottom of the
          fixed-height viewport, chat-style. */}
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
          const animate = !(
            message.sender === 'self' && suppressSelfAnimation
          )
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
