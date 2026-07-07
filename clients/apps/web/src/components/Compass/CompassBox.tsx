'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChevronRight } from 'lucide-react'
import { schemas } from '@polar-sh/client'
import { useEffect, useRef, useState } from 'react'
import { useCompassAssistant } from '@/hooks/useCompassAssistant'
import { CompassConversation } from './CompassConversation'
import { CompassInputBar } from './CompassInputBar'

/**
 * Exploration: the Compass agentic chat entry point.
 *
 * Idle, it's a box stuck to the bottom of the dashboard body (within the
 * content column, never over the sidebar) with a gradient fading the overview
 * under it. The first character the merchant types fades the conversation
 * overlay in over the page and hands focus to it, so typing flows straight
 * into the thread.
 */
export const CompassBox = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const [value, setValue] = useState('')
  const [active, setActive] = useState(false)
  const { messages, send, isStreaming } = useCompassAssistant(organization.id)
  const conversationInputRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    // Focusing the idle box fades the conversation over the page; hand
    // focus to the conversation input so typing flows straight into it.
    if (active) conversationInputRef.current?.focus()
  }, [active])

  const handleAsk = (question: string) => {
    const content = question.trim()
    if (!content || isStreaming) return
    setActive(true)
    void send(content)
    setValue('')
  }

  const handleSubmit = () => handleAsk(value)

  return (
    <>
      <CompassConversation
        active={active}
        organization={organization}
        messages={messages}
        isStreaming={isStreaming}
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
              color="text-secondary"
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
          >
            <CompassInputBar
              value={value}
              onValueChange={setValue}
              onSubmit={handleSubmit}
              onFocus={() => setActive(true)}
            />
          </Box>
        </Box>
      )}
    </>
  )
}
