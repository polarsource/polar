import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { motion } from 'framer-motion'
import React, { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { MessageAttachments } from './MessageAttachments'
import { exactTime, relativeTime } from './time'
import { type ChatAttachment, type ChatMessage } from './types'

// Bubbles spring up and scale in from the corner they were "sent" from,
// iMessage-style. Soft enough to be felt, settles in ~400ms with a gentle
// overshoot. Exported so custom rows (rendered via renderMessage) can match.
export const BUBBLE_SPRING = {
  type: 'spring',
  stiffness: 300,
  damping: 23,
  mass: 1,
} as const

export const ROW_FADE = { duration: 0.25, ease: 'easeOut' } as const

interface Props {
  message: ChatMessage
  attachments?: ChatAttachment[]
  // Avatar node for this message's sender; shown on the last bubble of a
  // group. Should render at 28px (h-7 w-7) to match the spacer.
  avatar?: React.ReactNode
  animate: boolean
  // Grouping flags for consecutive messages by the same sender (Messenger
  // style): inner corners connect, only the group's outer corners stay round,
  // the tail and avatar sit on the last bubble, and the timestamp shows once
  // per group.
  isFirstInGroup: boolean
  isLastInGroup: boolean
}

export const ChatBubble = ({
  message,
  attachments = [],
  avatar,
  animate,
  isFirstInGroup,
  isLastInGroup,
}: Props) => {
  // Freeze the entrance decision at mount so a later render can't re-trigger it.
  const [showEntrance] = useState(animate)

  const isSelf = message.sender === 'self'

  return (
    <motion.div
      initial={showEntrance ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={ROW_FADE}
    >
      <Box
        display="flex"
        flexDirection="column"
        alignItems={isSelf ? 'end' : 'start'}
        rowGap="xs"
        marginTop={isFirstInGroup ? 's' : 'none'}
      >
        <div
          className={`flex w-full items-end gap-2 ${
            isSelf ? 'flex-row-reverse' : ''
          }`}
        >
          {isLastInGroup ? avatar : <div className="w-7 shrink-0" />}
          <motion.div
            className="max-w-[80%]"
            initial={showEntrance ? { scale: 0.8, y: 10 } : false}
            animate={{ scale: 1, y: 0 }}
            transition={BUBBLE_SPRING}
            style={{
              transformOrigin: isSelf ? 'bottom right' : 'bottom left',
            }}
          >
            {/* Tailwind div instead of Box: the bubbles need different
                light/dark relationships than any existing Orbit token
                provides. */}
            <div
              className={twMerge(
                'flex flex-col gap-2 p-3',
                isSelf
                  ? twMerge(
                      'dark:bg-polar-100 rounded-l-2xl bg-neutral-800',
                      isFirstInGroup ? 'rounded-tr-2xl' : 'rounded-tr-lg',
                      !isLastInGroup && 'rounded-br-lg',
                    )
                  : twMerge(
                      'dark:bg-polar-600 rounded-r-2xl bg-gray-100',
                      isFirstInGroup ? 'rounded-tl-2xl' : 'rounded-tl-lg',
                      !isLastInGroup && 'rounded-bl-lg',
                    ),
              )}
            >
              {message.body && (
                <Text color={isSelf ? 'inverse' : 'default'}>
                  {message.body}
                </Text>
              )}
              <MessageAttachments attachments={attachments} inverse={isSelf} />
            </div>
          </motion.div>
        </div>
        {isLastInGroup && (
          <div
            className={isSelf ? 'mr-9' : 'ml-9'}
            title={exactTime(message.createdAt)}
          >
            <Text variant="caption" color="muted">
              {relativeTime(message.createdAt)}
            </Text>
          </div>
        )}
      </Box>
    </motion.div>
  )
}
