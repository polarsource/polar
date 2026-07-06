'use client'

import { AssistantMessage } from '@/hooks/useCompassAssistant'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import CloseRounded from '@mui/icons-material/CloseRounded'
import PercentRounded from '@mui/icons-material/PercentRounded'
import ShowChartRounded from '@mui/icons-material/ShowChartRounded'
import TrendingDownRounded from '@mui/icons-material/TrendingDownRounded'
import TrendingUpRounded from '@mui/icons-material/TrendingUpRounded'
import { ChevronRight } from 'lucide-react'
import { ComponentType, RefObject, useEffect, useRef } from 'react'
import { twMerge } from 'tailwind-merge'
import { AssistantPartView } from './AssistantBlocks'
import { CompassInputBar } from './CompassInputBar'
import { CompassWidget } from './CompassWidget'

interface CompassConversationProps {
  active: boolean
  organization: schemas['Organization']
  messages: AssistantMessage[]
  isStreaming: boolean
  value: string
  onValueChange: (value: string) => void
  onSubmit: () => void
  onAsk: (question: string) => void
  onClose: () => void
  inputRef: RefObject<HTMLTextAreaElement | null>
}

const PRESETS: {
  question: string
  action: string
  Icon: ComponentType<{ className?: string; style?: object }>
}[] = [
  {
    question: 'How is my MRR trending this month?',
    action: 'MRR trend',
    Icon: TrendingUpRounded,
  },
  {
    question: 'Which product has the weakest margin?',
    action: 'Product margins',
    Icon: PercentRounded,
  },
  {
    question: 'Why did churn go up recently?',
    action: 'Churn breakdown',
    Icon: TrendingDownRounded,
  },
  {
    question: 'What is driving my revenue growth?',
    action: 'Revenue drivers',
    Icon: ShowChartRounded,
  },
]

/** The nearest scrollable ancestor, so we can snap it to the top. */
const findScrollParent = (el: HTMLElement | null): HTMLElement | null => {
  let node = el?.parentElement ?? null
  while (node) {
    const overflowY = getComputedStyle(node).overflowY
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      node.scrollHeight > node.clientHeight
    ) {
      return node
    }
    node = node.parentElement
  }
  return null
}

/**
 * The conversation surface: a solid panel that covers the dashboard body
 * (`absolute inset-0`, anchored to the relative body container, so it never
 * touches the sidebar). Empty, it offers a 2x2 grid of preset questions;
 * once there are messages it renders the streamed thread — text parts and
 * generative-UI blocks via the block registry.
 */
export const CompassConversation = ({
  active,
  organization,
  messages,
  isStreaming,
  value,
  onValueChange,
  onSubmit,
  onAsk,
  onClose,
  inputRef,
}: CompassConversationProps) => {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!active) return
    findScrollParent(rootRef.current)?.scrollTo({ top: 0 })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, onClose])

  const empty = messages.length === 0

  return (
    <div
      ref={rootRef}
      className={twMerge(
        'dark:bg-polar-900 absolute inset-0 z-40 flex flex-col items-center bg-white transition-opacity duration-300 ease-out',
        active ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
    >
      <div className="flex w-full items-center justify-end px-6 py-4">
        <button
          type="button"
          aria-label="Close conversation"
          onClick={onClose}
          className="dark:text-polar-400 dark:hover:bg-polar-800 dark:hover:text-polar-100 flex size-9 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
        >
          <CloseRounded style={{ fontSize: '1.25rem' }} />
        </button>
      </div>

      <div className="flex w-full flex-1 justify-center overflow-y-auto px-6">
        <div className="flex w-full max-w-[760px] flex-col gap-y-8">
          <Text variant="heading-s">Compass</Text>
          {empty ? (
            <Box display="flex" flexDirection="column" rowGap="2xl">
              <div className="grid grid-cols-2 grid-rows-2 gap-4">
                {PRESETS.map(({ question, action, Icon }) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => onAsk(question)}
                    className="dark:border-polar-700 dark:hover:border-polar-600 dark:hover:bg-polar-700 flex flex-col gap-3 rounded-2xl border border-gray-200 p-4 text-left transition-colors hover:border-gray-300 hover:bg-gray-50"
                  >
                    <Box columnGap="m" alignItems="center">
                      <Icon
                        className="dark:text-polar-500 text-gray-400"
                        style={{ fontSize: '1rem' }}
                      />
                      <Text>{question}</Text>
                    </Box>
                    <Box
                      color="text-secondary"
                      flexDirection="row"
                      alignItems="center"
                      columnGap="xs"
                    >
                      <Text variant="caption" color="muted">
                        {action}
                      </Text>
                      <ChevronRight size={14} />
                    </Box>
                  </button>
                ))}
              </div>
              <CompassWidget
                organization={organization}
                limit={3}
                hideHeader
                hideWhenEmpty
                layout="column"
                size="small"
              />
            </Box>
          ) : (
            <Box display="flex" flexDirection="column" rowGap="2xl">
              {messages.map((message) =>
                message.role === 'user' ? (
                  <Box
                    key={message.id}
                    alignSelf="end"
                    maxWidth="85%"
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
                ) : (
                  <Box
                    key={message.id}
                    display="flex"
                    flexDirection="column"
                    rowGap="2xl"
                    maxWidth="85%"
                  >
                    {message.parts.length === 0 && isStreaming ? (
                      <Text color="muted">Thinking...</Text>
                    ) : (
                      message.parts.map((part, i) => (
                        <AssistantPartView
                          key={i}
                          part={part}
                          organization={organization}
                        />
                      ))
                    )}
                  </Box>
                ),
              )}
            </Box>
          )}
        </div>
      </div>

      <div className="flex w-full justify-center px-6 pb-8">
        <div className="w-full max-w-[760px]">
          <CompassInputBar
            ref={inputRef}
            value={value}
            onValueChange={onValueChange}
            onSubmit={onSubmit}
          />
        </div>
      </div>
    </div>
  )
}
