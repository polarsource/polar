import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { motion } from 'framer-motion'
import React, { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { type CaseAttachment } from './caseAttachments'
import { MessageAttachments } from './MessageAttachments'
import { MessageAvatar } from './MessageAvatar'
import { exactTime, relativeTime } from './time'

export const BUBBLE_SPRING = {
  type: 'spring',
  stiffness: 300,
  damping: 23,
  mass: 1,
} as const

export const ROW_FADE = { duration: 0.25, ease: 'easeOut' } as const

interface Props {
  message: schemas['SupportCaseMessage']
  organization: schemas['Organization']
  attachments?: CaseAttachment[]
  animate: boolean
  isFirstInGroup: boolean
  isLastInGroup: boolean
}

export const ChatBubble = ({
  message,
  organization,
  attachments = [],
  animate,
  isFirstInGroup,
  isLastInGroup,
}: Props) => {
  const [showEntrance] = useState(animate)

  const fromMerchant = message.author_kind === 'merchant'

  return (
    <motion.div
      initial={showEntrance ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={ROW_FADE}
    >
      <Box
        display="flex"
        flexDirection="column"
        alignItems={fromMerchant ? 'end' : 'start'}
        rowGap="xs"
        marginTop={isFirstInGroup ? 's' : 'none'}
      >
        <div
          className={`flex w-full items-end gap-2 ${
            fromMerchant ? 'flex-row-reverse' : ''
          }`}
        >
          {isLastInGroup ? (
            <MessageAvatar
              organization={organization}
              fromMerchant={fromMerchant}
            />
          ) : (
            <div className="w-7 shrink-0" />
          )}
          <motion.div
            className="max-w-[80%]"
            initial={showEntrance ? { scale: 0.8, y: 10 } : false}
            animate={{ scale: 1, y: 0 }}
            transition={BUBBLE_SPRING}
            style={{
              transformOrigin: fromMerchant ? 'bottom right' : 'bottom left',
            }}
          >
            <div
              className={twMerge(
                'flex flex-col gap-2 p-3',
                fromMerchant
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
                <Text color={fromMerchant ? 'inverse' : 'default'}>
                  {message.body}
                </Text>
              )}
              <MessageAttachments
                attachments={attachments}
                organizationId={organization.id}
                inverse={fromMerchant}
              />
            </div>
          </motion.div>
        </div>
        {isLastInGroup && (
          <div
            className={fromMerchant ? 'mr-9' : 'ml-9'}
            title={exactTime(message.created_at)}
          >
            <Text variant="caption" color="muted">
              {relativeTime(message.created_at)}
            </Text>
          </div>
        )}
      </Box>
    </motion.div>
  )
}
