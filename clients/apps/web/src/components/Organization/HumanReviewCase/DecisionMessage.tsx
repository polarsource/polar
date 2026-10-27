import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { m } from 'motion/react'
import { Check, X } from '@polar-sh/orbit/icons'
import React from 'react'
import { BUBBLE_SPRING, ROW_FADE } from '@/components/Chat/ChatBubble'
import { exactTime, relativeTime } from '@/components/Chat/time'
import { MessageAvatar } from './MessageAvatar'

interface Props {
  message: schemas['SupportCaseMessage']
  organization: schemas['Organization']
}

export const DecisionMessage = ({ message, organization }: Props) => {
  const approved = message.type === 'appeal_approved'

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={ROW_FADE}
    >
      <Box
        display="flex"
        flexDirection="column"
        alignItems="start"
        rowGap="xs"
        marginTop="s"
      >
        <div className="flex w-full items-end gap-2">
          <MessageAvatar organization={organization} fromMerchant={false} />
          <m.div
            className="max-w-[80%]"
            initial={{ scale: 0.8, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            transition={BUBBLE_SPRING}
            style={{ transformOrigin: 'bottom left' }}
          >
            <div className="dark:bg-polar-600 flex flex-col gap-1 rounded-2xl rounded-bl-none bg-gray-100 p-3 whitespace-pre-wrap">
              <Box display="flex" alignItems="center" columnGap="xs">
                {approved ? (
                  <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <X className="h-4 w-4 shrink-0 text-red-500" />
                )}
                <Text variant="title">
                  Appeal {approved ? 'approved' : 'denied'}
                </Text>
              </Box>
              {message.body && <Text>{message.body}</Text>}
            </div>
          </m.div>
        </div>
        <div className="ml-9" title={exactTime(message.created_at)}>
          <Text variant="caption" color="muted">
            {relativeTime(message.created_at)}
          </Text>
        </div>
      </Box>
    </m.div>
  )
}
