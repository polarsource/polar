'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import ArrowUpwardRounded from '@mui/icons-material/ArrowUpwardRounded'
import AttachFileRounded from '@mui/icons-material/AttachFileRounded'
import CropFreeRounded from '@mui/icons-material/CropFreeRounded'
import KeyboardArrowDownRounded from '@mui/icons-material/KeyboardArrowDownRounded'
import ViewInArOutlined from '@mui/icons-material/ViewInArOutlined'
import { ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CompassConversation, CompassMessage } from './CompassConversation'

/**
 * Exploration: the Compass agentic chat entry point.
 *
 * Idle, it's a box stuck to the bottom of the dashboard body (within the
 * content column, never over the sidebar) with a gradient fading the overview
 * under it. The first character the merchant types fades the conversation
 * overlay in over the page and hands focus to it, so typing flows straight
 * into the thread.
 */
export const CompassBox = () => {
  const [value, setValue] = useState('')
  const [active, setActive] = useState(false)
  const [messages, setMessages] = useState<CompassMessage[]>([])
  const idRef = useRef(0)
  const conversationInputRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (active) conversationInputRef.current?.focus()
  }, [active])

  const nextId = () => `m${(idRef.current += 1)}`

  // Focusing the idle box fades the conversation over the page and hands
  // focus to it (see the [active] effect above).

  const handleAsk = (question: string) => {
    const content = question.trim()
    if (!content) return
    setActive(true)
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: 'user', content },
      {
        id: nextId(),
        role: 'assistant',
        content: 'Looking through your metrics…',
      },
    ])
    setValue('')
  }

  const handleSubmit = () => handleAsk(value)

  return (
    <>
      <CompassConversation
        active={active}
        messages={messages}
        value={value}
        onValueChange={setValue}
        onSubmit={handleSubmit}
        onAsk={handleAsk}
        onClose={() => setActive(false)}
        inputRef={conversationInputRef}
      />

      {!active && (
        <Box
          position="sticky"
          left={0}
          right={0}
          bottom={0}
          zIndex={30}
          display="flex"
          justifyContent="center"
          alignItems="end"
          paddingHorizontal="l"
          paddingBottom="xl"
        >
          {/* Gradient fade — content scrolls under it toward the bottom. */}
          <div className="dark:from-polar-900 dark:via-polar-900/90 pointer-events-none absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-white via-white/90 to-transparent" />

          <Box
            position="absolute"
            display="flex"
            paddingVertical="m"
            paddingHorizontal="l"
            top={-36}
            left={12}
            right={12}
            borderTopRightRadius="l"
            borderTopLeftRadius="l"
            backgroundColor="background-card"
            maxWidth={720}
            marginHorizontal="auto"
          >
            <Box
              color={{
                base: 'text-secondary',
                hover: 'text-primary',
              }}
              transitionProperty="colors"
              transitionDuration="fast"
              cursor="pointer"
              flexDirection="row"
              alignItems="center"
              columnGap="xs"
            >
              <Text variant="caption" color="inherit">
                Introducing Polar Compass
              </Text>
              <ChevronRight size={14} />
            </Box>
          </Box>

          <Box
            position="relative"
            pointerEvents="auto"
            width="100%"
            maxWidth={760}
            display="flex"
            flexDirection="column"
            rowGap="s"
            padding="l"
            borderRadius="xl"
            borderWidth={1}
            borderStyle="solid"
            borderColor="border-secondary"
            backgroundColor="background-secondary"
            boxShadow="xl"
          >
            <textarea
              value={value}
              onFocus={() => setActive(true)}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
              rows={1}
              placeholder="Ask Compass..."
              className="dark:text-polar-50 dark:placeholder:text-polar-500 dark:caret-polar-50 z-10 w-full resize-none border-0 bg-transparent px-1 text-sm text-gray-900 caret-gray-900 outline-none placeholder:text-gray-400 focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:outline-none"
            />

            <Box
              display="flex"
              flexDirection="row"
              alignItems="center"
              justifyContent="between"
            >
              <button
                type="button"
                className="dark:text-polar-300 dark:hover:bg-polar-700 flex items-center gap-x-1.5 rounded-full px-2.5 py-1.5 text-gray-600 transition-colors hover:bg-gray-100"
              >
                <ViewInArOutlined style={{ fontSize: '1rem' }} />
                <Text>Skills</Text>
                <KeyboardArrowDownRounded style={{ fontSize: '1.125rem' }} />
              </button>

              <Box display="flex" alignItems="center" columnGap="s">
                <button
                  type="button"
                  aria-label="Expand"
                  className="dark:text-polar-400 dark:hover:bg-polar-700 dark:hover:text-polar-200 flex size-9 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                >
                  <CropFreeRounded style={{ fontSize: '1.125rem' }} />
                </button>
                <button
                  type="button"
                  aria-label="Attach"
                  className="dark:text-polar-400 dark:hover:bg-polar-700 dark:hover:text-polar-200 flex size-9 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                >
                  <AttachFileRounded style={{ fontSize: '1.125rem' }} />
                </button>
                <button
                  type="button"
                  aria-label="Send"
                  disabled={value.trim().length === 0}
                  onClick={handleSubmit}
                  className="dark:bg-polar-50 flex size-9 items-center justify-center rounded-full bg-gray-900 text-white transition-opacity disabled:opacity-40 dark:text-gray-900"
                >
                  <ArrowUpwardRounded style={{ fontSize: '1.125rem' }} />
                </button>
              </Box>
            </Box>
          </Box>
        </Box>
      )}
    </>
  )
}
