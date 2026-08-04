'use client'

import { messageTime, relativeTime } from '@/components/Chat/time'
import { AssistantMessage } from '@/hooks/useCompassAssistant'
import RefreshRounded from '@mui/icons-material/RefreshRounded'
import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { AnimatePresence, motion } from 'motion/react'
import { Fragment } from 'react'
import { AssistantPartView } from './AssistantBlocks'

const STALE_AFTER_MS = 60 * 60 * 1000
const isStale = (iso: string) =>
  Date.now() - new Date(iso).getTime() > STALE_AFTER_MS

interface CompassMessageListProps {
  organization: schemas['Organization']
  messages: AssistantMessage[]
  isStreaming: boolean
  onAsk: (question: string) => void
}

const MessageTimestamp = ({ at }: { at: string }) => (
  <div className="opacity-0 transition-opacity duration-150 group-hover:opacity-100">
    <Text variant="caption" color="muted">
      {messageTime(at)}
    </Text>
  </div>
)

const ResumeDivider = ({ answeredAt }: { answeredAt: string }) => (
  <Box role="separator" alignItems="center" columnGap="m">
    <Box
      flexGrow={1}
      borderTopWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
    />
    <Text variant="caption" color="muted">
      Continuing from {relativeTime(answeredAt)}
    </Text>
    <Box
      flexGrow={1}
      borderTopWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
    />
  </Box>
)

const RerunAction = ({
  prompt,
  disabled,
  onAsk,
}: {
  prompt: string
  disabled: boolean
  onAsk: (question: string) => void
}) => (
  <Box>
    <Button
      variant="secondary"
      size="sm"
      disabled={disabled}
      onClick={() => onAsk(prompt)}
    >
      <Box alignItems="center" columnGap="xs">
        <RefreshRounded style={{ fontSize: '1rem' }} />
        Ask again with current data
      </Box>
    </Button>
  </Box>
)

export const CompassMessageList = ({
  organization,
  messages,
  isStreaming,
  onAsk,
}: CompassMessageListProps) => {
  const showsGapAfter = (message: AssistantMessage, index: number) => {
    const next = messages[index + 1]
    if (next) {
      const gap =
        new Date(next.answeredAt).getTime() -
        new Date(message.answeredAt).getTime()
      return gap > STALE_AFTER_MS
    }
    return Boolean(message.restored) && isStale(message.answeredAt)
  }

  return (
    <Box display="flex" flexDirection="column" rowGap="2xl">
      <AnimatePresence initial={false}>
        {messages.map((message, index) => (
          <Fragment key={message.id}>
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="group flex"
            >
              {message.role === 'user' ? (
                <Box
                  marginLeft="auto"
                  maxWidth="85%"
                  flexDirection="column"
                  rowGap="xs"
                  alignItems="end"
                >
                  <Box
                    paddingHorizontal="l"
                    paddingVertical="m"
                    borderRadius="l"
                    backgroundColor="background-card"
                  >
                    {message.parts.map((part, i) => (
                      <AssistantPartView
                        key={i}
                        part={part}
                        organization={organization}
                      />
                    ))}
                  </Box>
                  <MessageTimestamp at={message.answeredAt} />
                </Box>
              ) : (
                <Box
                  display="flex"
                  flexDirection="column"
                  rowGap="m"
                  maxWidth="100%"
                >
                  <Box display="flex" flexDirection="column" rowGap="2xl">
                    {message.parts.length === 0 && isStreaming ? (
                      <span className="dark:from-polar-500 dark:via-polar-100 dark:to-polar-500 w-fit [animation:shimmer_2s_linear_infinite] bg-linear-to-r from-gray-400 via-gray-800 to-gray-400 bg-size-[200%_100%] bg-clip-text text-transparent">
                        Thinking...
                      </span>
                    ) : (
                      message.parts.map((part, i) => (
                        <AssistantPartView
                          key={i}
                          part={part}
                          organization={organization}
                          answeredAt={message.answeredAt}
                        />
                      ))
                    )}
                  </Box>
                  {message.restored &&
                    message.prompt &&
                    isStale(message.answeredAt) &&
                    message.parts.some((part) => part.kind === 'block') && (
                      <RerunAction
                        prompt={message.prompt}
                        disabled={isStreaming}
                        onAsk={onAsk}
                      />
                    )}
                  <MessageTimestamp at={message.answeredAt} />
                </Box>
              )}
            </motion.div>
            {showsGapAfter(message, index) && (
              <ResumeDivider answeredAt={message.answeredAt} />
            )}
          </Fragment>
        ))}
      </AnimatePresence>
    </Box>
  )
}
