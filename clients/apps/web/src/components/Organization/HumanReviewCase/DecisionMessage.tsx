import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import React from 'react'
import { BUBBLE_SPRING, ROW_FADE } from './ChatBubble'
import { MessageAvatar } from './MessageAvatar'
import { exactTime, relativeTime } from './time'

interface Props {
  message: schemas['SupportCaseMessage']
  organization: schemas['Organization']
}

export const DecisionMessage = ({ message, organization }: Props) => {
  const approved = message.type === 'appeal_approved'

  return (
    <motion.div
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
          <motion.div
            className="max-w-[80%]"
            initial={{ scale: 0.8, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            transition={BUBBLE_SPRING}
            style={{ transformOrigin: 'bottom left' }}
          >
            <div className="dark:bg-polar-600 flex flex-col gap-1 rounded-2xl rounded-bl-none bg-gray-100 p-3">
              <Box display="flex" alignItems="center" columnGap="xs">
                {approved ? (
                  <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <X className="h-4 w-4 shrink-0 text-red-500" />
                )}
                <Text as="strong">
                  Appeal {approved ? 'approved' : 'denied'}
                </Text>
              </Box>
              {message.body && <Text>{message.body}</Text>}
            </div>
          </motion.div>
        </div>
        <div className="ml-9" title={exactTime(message.created_at)}>
          <Text variant="caption" color="muted">
            {relativeTime(message.created_at)}
          </Text>
        </div>
      </Box>
    </motion.div>
  )
}
