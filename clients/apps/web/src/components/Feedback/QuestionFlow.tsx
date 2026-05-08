'use client'

import { MemoizedMarkdown } from '@/components/Markdown/MemoizedMarkdown'
import { useChat } from '@ai-sdk/react'
import Button from '@polar-sh/ui/components/atoms/Button'
import { DefaultChatTransport } from 'ai'
import { useEffect, useMemo, useRef, useState } from 'react'

interface QuestionFlowProps {
  question: string
  onForwardToSupport: () => void
  onCancel: () => void
  isForwarding: boolean
}

const FALLBACK_DELAY_MS = 3000

export const QuestionFlow = ({
  question,
  onForwardToSupport,
  onCancel,
  isForwarding,
}: QuestionFlowProps) => {
  const [showFallback, setShowFallback] = useState(false)
  const hasSentRef = useRef(false)

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: '/feedback/question',
      credentials: 'include',
    }),
  })

  useEffect(() => {
    if (hasSentRef.current) return
    hasSentRef.current = true
    sendMessage({ text: question })
  }, [question, sendMessage])

  const assistantText = useMemo(() => {
    const assistant = messages.find((m) => m.role === 'assistant')
    if (!assistant) return ''
    return assistant.parts
      .filter((part): part is { type: 'text'; text: string } =>
        part.type === 'text' && typeof (part as { text?: unknown }).text === 'string',
      )
      .map((part) => part.text)
      .join('')
  }, [messages])

  const isStreaming = status === 'submitted' || status === 'streaming'

  useEffect(() => {
    if (status !== 'ready' || !assistantText) return
    const timer = setTimeout(() => setShowFallback(true), FALLBACK_DELAY_MS)
    return () => clearTimeout(timer)
  }, [status, assistantText])

  const showFallbackButton = showFallback || !!error

  return (
    <div className="flex flex-col gap-y-6">
      <div className="dark:bg-polar-800 self-end rounded-2xl bg-gray-100 px-4 py-2 text-sm">
        {question}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          We could not load an answer right now. You can forward your question
          to our support team instead.
        </div>
      )}

      {!error &&
        (assistantText ? (
          <div className="prose prose-sm dark:prose-invert dark:text-white">
            <MemoizedMarkdown content={assistantText} />
          </div>
        ) : (
          <div className="dark:text-polar-400 flex items-center gap-2 text-sm text-gray-400">
            <span className="dark:bg-polar-400 h-2 w-2 animate-pulse rounded-full bg-gray-400" />
            Looking up an answer in our docs…
          </div>
        ))}

      <div className="flex justify-end gap-2">
        {showFallbackButton ? (
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              disabled={isForwarding}
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={onForwardToSupport}
              loading={isForwarding}
              disabled={isForwarding}
            >
              {isForwarding
                ? 'Forwarding…'
                : 'This did not answer my question. Forward to support.'}
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isStreaming}
          >
            Close
          </Button>
        )}
      </div>
    </div>
  )
}
