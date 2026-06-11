import {
  ScrollFade,
  type ScrollFadeHandle,
} from '@/components/Shared/ScrollFade'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import React, { useEffect, useState } from 'react'
import {
  attachmentsForMessage,
  type CaseAttachment,
} from './caseAttachments'
import { Message } from './Message'

interface Props {
  messages: schemas['SupportCaseMessage'][]
  organization: schemas['Organization']
  attachments?: CaseAttachment[]
  scrollToBottomSignal?: number
  scrollFadeRef?: React.Ref<ScrollFadeHandle>
  suppressMerchantAnimation?: boolean
}

export const MessageThread = ({
  messages,
  organization,
  attachments = [],
  scrollToBottomSignal,
  scrollFadeRef,
  suppressMerchantAnimation,
}: Props) => {
  const [, setTimeTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setTimeTick((t) => t + 1), 60_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <ScrollFade
      ref={scrollFadeRef}
      className="-mr-4 flex h-[420px] flex-col pr-4"
      stickToBottom
      scrollToBottomSignal={scrollToBottomSignal}
    >
      <Box display="flex" flexDirection="column" rowGap="xs" marginTop="auto">
        {messages.map((message, index) => {
          const prev = messages[index - 1]
          const next = messages[index + 1]
          const sameAuthor = (other?: schemas['SupportCaseMessage']) =>
            !!other &&
            other.type === 'chat' &&
            other.author_kind === message.author_kind
          const animate = !(
            message.author_kind === 'merchant' && suppressMerchantAnimation
          )
          return (
            <Message
              key={message.id}
              message={message}
              organization={organization}
              attachments={attachmentsForMessage(attachments, message.id)}
              animate={animate}
              isFirstInGroup={!sameAuthor(prev)}
              isLastInGroup={!sameAuthor(next)}
            />
          )
        })}
      </Box>
    </ScrollFade>
  )
}
