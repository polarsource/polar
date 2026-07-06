'use client'

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
import { CompassInputBar } from './CompassInputBar'

export interface CompassMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface CompassConversationProps {
  active: boolean
  messages: CompassMessage[]
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
 * once there are messages it shows the thread. Kept mounted and faded in for a
 * pure opacity crossfade, snapping the body to the top on open so it lines up.
 */
export const CompassConversation = ({
  active,
  messages,
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
        <div className="flex w-full max-w-[760px] flex-col gap-y-12">
          <Text variant="heading-s">Compass</Text>
          {empty ? (
            <div className="grid grid-cols-2 grid-rows-2 gap-4">
              {PRESETS.map(({ question, action, Icon }) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => onAsk(question)}
                  className="dark:border-polar-700 dark:hover:border-polar-600 dark:hover:bg-polar-800 flex cursor-pointer flex-col gap-3 rounded-2xl border border-gray-200 p-4 text-left transition-colors hover:border-gray-300 hover:bg-gray-50"
                >
                  <Box flexDirection="row" columnGap="m" alignItems="center">
                    <Icon style={{ fontSize: '1rem' }} />
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
          ) : (
            <Box display="flex" flexDirection="column" rowGap="l">
              {messages.map((message) => (
                <Box
                  key={message.id}
                  alignSelf={message.role === 'user' ? 'end' : 'start'}
                  maxWidth="85%"
                  paddingHorizontal="l"
                  paddingVertical="m"
                  borderRadius="l"
                  backgroundColor={
                    message.role === 'user' ? 'background-card' : undefined
                  }
                >
                  <Text color={message.role === 'user' ? undefined : 'muted'}>
                    {message.content}
                  </Text>
                </Box>
              ))}
            </Box>
          )}
        </div>
      </div>

      <div className="flex w-full justify-center px-6 pb-6">
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
