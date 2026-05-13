'use client'

import { useChat } from '@ai-sdk/react'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import Button from '@polar-sh/ui/components/atoms/Button'
import TextArea from '@polar-sh/ui/components/atoms/TextArea'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ChatMessageBubble } from './ChatMessageBubble'
import { EscalationCard } from './EscalationCard'
import { buildTranscript, extractText } from './messages'

interface QuestionFlowProps {
  question: string
  conversationId: string
  organizationId: string
  onEscalate: (message: string, type: schemas['FeedbackType']) => void
  onCancel: () => void
  isEscalating: boolean
}

const isPendingToolState = (state: unknown): boolean =>
  state === 'input-streaming' || state === 'input-available'

const getStreamingStatus = (messages: UIMessage[]): string => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (message.role !== 'assistant') continue
    for (let j = message.parts.length - 1; j >= 0; j--) {
      const part = message.parts[j] as { type: string; state?: unknown }
      if (!isPendingToolState(part.state)) continue
      if (part.type === 'tool-search') return 'Looking things up…'
      if (part.type === 'tool-fetchPageContent')
        return 'Reading the documentation…'
    }
    break
  }
  return 'Thinking…'
}

const isFeedbackType = (value: unknown): value is schemas['FeedbackType'] =>
  value === 'question' || value === 'feedback' || value === 'bug'

const findEscalationType = (
  messages: UIMessage[],
): schemas['FeedbackType'] | null => {
  for (const message of messages) {
    if (message.role !== 'assistant') continue
    for (const part of message.parts) {
      if (part.type !== 'tool-escalateToHuman') continue
      const typedPart = part as {
        state?: unknown
        input?: { type?: unknown }
      }
      // Wait for the tool input to finish streaming — a partial `input.type`
      // would mount EscalationCard with the 'question' fallback, which
      // useState then locks in even after the real type arrives.
      if (typedPart.state === 'input-streaming') continue
      return isFeedbackType(typedPart.input?.type)
        ? typedPart.input.type
        : 'question'
    }
  }
  return null
}

// When the backend forces the escalation tool on the last allowed turn, the
// model skips its usual warm preamble — detect that so we can render a
// friendly fallback in its place.
const hasEscalationPreamble = (messages: UIMessage[]): boolean => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (message.role !== 'assistant') continue
    const hasEscalation = message.parts.some(
      (part) => part.type === 'tool-escalateToHuman',
    )
    if (!hasEscalation) continue
    return extractText(message).trim().length > 0
  }
  return false
}

export const QuestionFlow = ({
  question,
  conversationId,
  organizationId,
  onEscalate,
  onCancel,
  isEscalating,
}: QuestionFlowProps) => {
  const hasSentRef = useRef(false)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState('')

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/feedback/question',
        credentials: 'include',
        body: { conversationId, organizationId },
      }),
    [conversationId, organizationId],
  )

  const { messages, sendMessage, setMessages, status, error } = useChat({
    transport,
  })

  useEffect(() => {
    if (hasSentRef.current) return
    hasSentRef.current = true
    sendMessage({ text: question })
  }, [question, sendMessage])

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const escalationType = useMemo(() => findEscalationType(messages), [messages])
  const showEscalationFallback = useMemo(
    () => escalationType !== null && !hasEscalationPreamble(messages),
    [escalationType, messages],
  )
  const isStreaming = status === 'submitted' || status === 'streaming'
  const streamingStatus = useMemo(
    () => getStreamingStatus(messages),
    [messages],
  )

  const handleSend = useCallback(() => {
    const text = draft.trim()
    if (!text || isStreaming || escalationType !== null) return
    sendMessage({ text })
    setDraft('')
  }, [draft, isStreaming, escalationType, sendMessage])

  const handleReset = useCallback(() => {
    setMessages([])
    setDraft('')
  }, [setMessages])

  const handleEscalateSubmit = useCallback(
    (note: string, type: schemas['FeedbackType']) => {
      const transcript = buildTranscript(messages)
      const trimmed = note.trim()
      const message = trimmed
        ? `${trimmed}\n\n---\n\n## Transcript\n\n${transcript}`
        : `## Transcript\n\n${transcript}`
      onEscalate(message, type)
    },
    [messages, onEscalate],
  )

  return (
    <Box
      display="flex"
      flexDirection="column"
      rowGap="l"
      flex={1}
      minHeight={0}
      paddingBottom="2xl"
    >
      <Box
        ref={scrollerRef}
        display="flex"
        flexDirection="column"
        rowGap="l"
        overflowY="auto"
        flex={1}
        minHeight={0}
      >
        {messages.map((message) => (
          <ChatMessageBubble key={message.id} message={message} />
        ))}
        {showEscalationFallback && (
          <div className="prose prose-sm dark:prose-invert">
            <p>
              Looks like a human teammate can take this further. If you want,
              you can hand this off to the Polar team. Add anything else
              you&rsquo;d like to share below and click Send.
            </p>
          </div>
        )}
        {isStreaming && (
          <Box
            display="flex"
            alignItems="center"
            columnGap="s"
            color="text-tertiary"
          >
            <span className="dark:bg-polar-400 h-2 w-2 animate-pulse rounded-full bg-gray-400" />
            <span className="text-sm">{streamingStatus}</span>
          </Box>
        )}
        {error && (
          <Box
            borderRadius="l"
            backgroundColor="background-warning"
            borderWidth={1}
            borderStyle="solid"
            borderColor="border-warning"
            padding="l"
            color="text-warning"
          >
            <p className="text-sm">
              We could not load an answer right now. Try again or close this
              window.
            </p>
          </Box>
        )}
      </Box>

      {escalationType !== null ? (
        <EscalationCard
          initialType={escalationType}
          onSubmit={handleEscalateSubmit}
          onCancel={onCancel}
          isSubmitting={isEscalating}
        />
      ) : (
        <Box display="flex" flexDirection="column" rowGap="s">
          <TextArea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask a follow-up…"
            disabled={isStreaming}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                !event.shiftKey &&
                !event.metaKey &&
                !event.ctrlKey &&
                !event.altKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault()
                handleSend()
              }
            }}
          />
          <Box display="flex" justifyContent="end" columnGap="s">
            <Button
              type="button"
              variant="ghost"
              onClick={handleReset}
              disabled={isStreaming || messages.length === 0}
            >
              I have another question
            </Button>
            <Button
              type="button"
              onClick={handleSend}
              disabled={!draft.trim() || isStreaming}
            >
              Send
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  )
}
