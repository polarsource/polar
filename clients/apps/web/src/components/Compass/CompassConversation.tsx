'use client'

import { useCompassInsights } from '@/hooks/queries'
import { AssistantMessage } from '@/hooks/useCompassAssistant'
import { useStickToBottom } from '@/hooks/useStickToBottom'
import PercentRounded from '@mui/icons-material/PercentRounded'
import ShowChartRounded from '@mui/icons-material/ShowChartRounded'
import TrendingDownRounded from '@mui/icons-material/TrendingDownRounded'
import TrendingUpRounded from '@mui/icons-material/TrendingUpRounded'
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { ComponentType, RefObject, useEffect } from 'react'
import { AssistantPartView } from './AssistantBlocks'
import { CompassInputBar } from './CompassInputBar'
import { CompassWidget } from './CompassWidget'

interface CompassConversationProps {
  organization: schemas['Organization']
  messages: AssistantMessage[]
  isStreaming: boolean
  value: string
  onValueChange: (value: string) => void
  onSubmit: () => void
  onAsk: (question: string) => void
  inputRef: RefObject<HTMLTextAreaElement | null>
}

const PRESETS: {
  question: string
  Icon: ComponentType<{ className?: string; style?: object }>
}[] = [
  {
    question: 'How is my MRR trending this month?',
    Icon: TrendingUpRounded,
  },
  {
    question: 'Which product has the weakest margin?',
    Icon: PercentRounded,
  },
  {
    question: 'Why did churn go up recently?',

    Icon: TrendingDownRounded,
  },
  {
    question: 'What is driving my revenue growth?',
    Icon: ShowChartRounded,
  },
]

const CATEGORY_ICON: Record<
  schemas['InsightCategory'],
  ComponentType<{ className?: string; style?: object }>
> = {
  revenue: TrendingUpRounded,
  retention: TrendingDownRounded,
  growth: ShowChartRounded,
  risk: WarningAmberRounded,
  cost: PercentRounded,
  product: PercentRounded,
}

/**
 * Turn the live insights feed into launchpad prompts: each firing insight that
 * carries a `suggested_prompt` becomes a one-tap question phrased for that exact
 * finding. Falls back to the static starters when nothing is firing yet (cold
 * start), so the empty state is never blank.
 */
const presetsFromInsights = (
  insights: schemas['Insight'][] | undefined,
): typeof PRESETS => {
  const dynamic = (insights ?? [])
    .filter((insight) => insight.suggested_prompt)
    .slice(0, 4)
    .map((insight) => ({
      question: insight.suggested_prompt as string,
      action: insight.category_label,
      Icon: CATEGORY_ICON[insight.category] ?? ShowChartRounded,
    }))
  return dynamic.length > 0 ? dynamic : PRESETS
}

/**
 * The Compass conversation, laid out as page content on the /compass route.
 * Empty, it offers preset questions and a compact insights digest; once there
 * are messages it renders the streamed thread of text and generative UI
 * blocks. The input stays pinned to the bottom of the dashboard body.
 */
export const CompassConversation = ({
  organization,
  messages,
  isStreaming,
  value,
  onValueChange,
  onSubmit,
  onAsk,
  inputRef,
}: CompassConversationProps) => {
  const empty = messages.length === 0
  const { contentRef, scrollToBottom } = useStickToBottom<HTMLDivElement>()

  // The "Insights" header lives here rather than in the widget, so the whole
  // section (header included) must collapse when there is nothing to show.
  // Same query key as the widget's own fetch, so this doesn't hit the API
  // twice. Errors keep the section: the widget renders its failure alert there.
  const compassEnabled = !!organization.feature_settings?.compass_enabled
  const {
    data: insights,
    isLoading: insightsLoading,
    isError: insightsError,
  } = useCompassInsights(organization.id, compassEnabled)
  const showInsights =
    compassEnabled &&
    !insightsLoading &&
    (insightsError || (insights ?? []).length > 0)
  const presets = presetsFromInsights(insights)

  // Sending always re-follows the bottom, even if the user had scrolled up
  // in the previous answer. Streamed growth is handled by the hook itself.
  const lastMessage = messages[messages.length - 1]
  useEffect(() => {
    if (lastMessage?.role === 'user') {
      scrollToBottom()
    }
  }, [lastMessage, scrollToBottom])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex min-h-full w-full flex-col items-center"
    >
      <div
        ref={contentRef}
        className="flex w-full flex-1 flex-col gap-y-12 pb-6"
      >
        {empty ? (
          <Box display="flex" flexDirection="column" rowGap="xl">
            <div className="grid grid-cols-2 gap-4">
              {presets.map(({ question, Icon }) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => onAsk(question)}
                  className="dark:border-polar-700 dark:hover:border-polar-600 dark:hover:bg-polar-700 flex cursor-pointer flex-col gap-3 rounded-2xl border border-gray-200 p-4 text-left transition-colors hover:border-gray-300 hover:bg-gray-50"
                >
                  <Box columnGap="m" alignItems="start">
                    <Icon
                      className="dark:text-polar-500 text-gray-400"
                      style={{ fontSize: '1rem', marginTop: '.2rem' }}
                    />

                    <Box flexDirection="column" rowGap="xs">
                      <Text>{question}</Text>
                      <Box
                        color="text-secondary"
                        flexDirection="row"
                        alignItems="center"
                        columnGap="xs"
                      >
                        <Text variant="caption" color="muted">
                          Ask Compass
                        </Text>
                        <ChevronRight size={14} />
                      </Box>
                    </Box>
                  </Box>
                </button>
              ))}
            </div>
            {showInsights && (
              <Box display="flex" flexDirection="column" rowGap="m">
                <Box flexDirection="row" justifyContent="between" gap="l">
                  <Text variant="heading-xxs">Insights</Text>
                  <Link
                    href={`/dashboard/${organization.slug}/compass/insights`}
                    className="self-end"
                  >
                    <Box
                      color={{ base: 'text-secondary', hover: 'text-primary' }}
                      transitionProperty="colors"
                      transitionDuration="fast"
                      flexDirection="row"
                      alignItems="center"
                      columnGap="xs"
                    >
                      <Text variant="caption" color="inherit">
                        View all insights
                      </Text>
                      <ChevronRight size={14} />
                    </Box>
                  </Link>
                </Box>
                <CompassWidget
                  organization={organization}
                  limit={2}
                  columns={2}
                  hideHeader
                  layout="grid"
                  size="small"
                />
              </Box>
            )}
          </Box>
        ) : (
          <Box display="flex" flexDirection="column" rowGap="2xl">
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="flex"
                >
                  {message.role === 'user' ? (
                    <Box
                      marginLeft="auto"
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
                      display="flex"
                      flexDirection="column"
                      rowGap="2xl"
                      maxWidth="85%"
                    >
                      {message.parts.length === 0 && isStreaming ? (
                        <span className="dark:from-polar-500 dark:via-polar-100 dark:to-polar-500 w-fit [animation:shimmer_2s_linear_infinite] bg-linear-to-r from-gray-400 via-gray-800 to-gray-400 bg-size-[200%_100%] bg-clip-text text-sm text-transparent">
                          Thinking...
                        </span>
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
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </Box>
        )}
      </div>

      <div className="sticky bottom-0 z-30 w-full pb-6">
        <div className="dark:from-polar-900 dark:via-polar-900/90 pointer-events-none absolute inset-x-0 -top-12 bottom-0 bg-gradient-to-t from-white via-white/90 to-transparent" />
        <div className="relative">
          <CompassInputBar
            ref={inputRef}
            value={value}
            onValueChange={onValueChange}
            onSubmit={onSubmit}
            autoFocus
          />
        </div>
      </div>
    </motion.div>
  )
}
