'use client'

import { useChat } from '@ai-sdk/react'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import TextArea from '@polar-sh/ui/components/atoms/TextArea'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ChatMessageBubble } from './ChatMessageBubble'
import { EscalationCard } from './EscalationCard'

interface QuestionFlowProps {
  question: string
  conversationId: string
  organizationId: string
  onEscalate: (message: string, type: schemas['FeedbackType']) => void
  onCancel: () => void
  isEscalating: boolean
}

type Escalation = {
  type: schemas['FeedbackType']
}

const extractText = (message: UIMessage): string =>
  message.parts
    .filter(
      (part): part is { type: 'text'; text: string } =>
        part.type === 'text' &&
        typeof (part as { text?: unknown }).text === 'string',
    )
    .map((part) => part.text)
    .join('')

const buildTranscript = (messages: UIMessage[]): string =>
  messages
    .map((message) => {
      const text = extractText(message).trim()
      if (!text) return null
      const speaker = message.role === 'user' ? 'User' : 'Assistant'
      return `${speaker}: ${text}`
    })
    .filter((line): line is string => line !== null)
    .join('\n\n')

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

const findEscalation = (messages: UIMessage[]): Escalation | null => {
  for (const message of messages) {
    if (message.role !== 'assistant') continue
    for (const part of message.parts) {
      if (part.type !== 'tool-escalateToHuman') continue
      const input = (part as { input?: { type?: unknown } }).input
      const type: schemas['FeedbackType'] = isFeedbackType(input?.type)
        ? input.type
        : 'question'
      return { type }
    }
  }
  return null
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

  const escalation = useMemo(() => findEscalation(messages), [messages])
  const isStreaming = status === 'submitted' || status === 'streaming'
  const streamingStatus = useMemo(
    () => getStreamingStatus(messages),
    [messages],
  )

  const handleSend = useCallback(() => {
    const text = draft.trim()
    if (!text || isStreaming || escalation !== null) return
    sendMessage({ text })
    setDraft('')
  }, [draft, isStreaming, escalation, sendMessage])

  const handleReset = useCallback(() => {
    setMessages([])
    setDraft('')
  }, [setMessages])

  const handleEscalateSubmit = useCallback(
    (note: string, type: schemas['FeedbackType']) => {
      const transcript = buildTranscript(messages)
      const trimmed = note.trim()
      const message = trimmed
        ? `${trimmed}\n\n---\nConversation transcript:\n\n${transcript}`
        : `Conversation transcript:\n\n${transcript}`
      onEscalate(message, type)
    },
    [messages, onEscalate],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 pb-8">
      <div
        ref={scrollerRef}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto"
      >
        {messages.map((message) => (
          <ChatMessageBubble key={message.id} message={message} />
        ))}
        {isStreaming && (
          <div className="dark:text-polar-400 flex items-center gap-2 text-sm text-gray-400">
            <span className="dark:bg-polar-400 h-2 w-2 animate-pulse rounded-full bg-gray-400" />
            {streamingStatus}
          </div>
        )}
        {error && (
          <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            We could not load an answer right now. Try again or close this
            window.
          </div>
        )}
      </div>

      {escalation !== null ? (
        <EscalationCard
          initialType={escalation.type}
          onSubmit={handleEscalateSubmit}
          onCancel={onCancel}
          isSubmitting={isEscalating}
        />
      ) : (
        <div className="flex flex-col gap-2">
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
          <div className="flex justify-end gap-2">
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
          </div>
        </div>
      )}
    </div>
  )
}
