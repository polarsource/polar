import { ScrollFade } from '@/components/Shared/ScrollFade'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import React from 'react'
import { Message } from './Message'

interface Props {
  messages: schemas['SupportCaseMessage'][]
}

export const MessageThread = ({ messages }: Props) => {
  return (
    <ScrollFade className="max-h-[420px]" stickToBottom>
      <Box display="flex" flexDirection="column" rowGap="xs">
        {messages.map((message, index) => {
          const prev = messages[index - 1]
          const next = messages[index + 1]
          const sameAuthor = (other?: schemas['SupportCaseMessage']) =>
            !!other &&
            other.type === 'chat' &&
            other.author_kind === message.author_kind
          return (
            <Message
              key={message.id}
              message={message}
              isFirstInGroup={!sameAuthor(prev)}
              isLastInGroup={!sameAuthor(next)}
            />
          )
        })}
      </Box>
    </ScrollFade>
  )
}
