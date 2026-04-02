'use client'

import { MemoizedMarkdown } from '@/components/Markdown/MemoizedMarkdown'
import { useChat } from '@ai-sdk/react'
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import TextArea from '@polar-sh/ui/components/atoms/TextArea'
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@polar-sh/ui/components/ui/sheet'
import { DefaultChatTransport } from 'ai'
import { useEffect, useRef, useState } from 'react'

import { MetricToolResult } from './MetricToolResult'

export function AssistantSheet({
  open,
  onOpenChange,
  organization,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  organization: schemas['Organization']
}) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: `/dashboard/${organization.slug}/assistant`,
      credentials: 'include',
      body: { organizationId: organization.id },
    }),
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [input])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim() && status === 'ready') {
      sendMessage({ text: input })
      setInput('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (input.trim() && status === 'ready') {
        sendMessage({ text: input })
        setInput('')
      }
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="dark:bg-polar-900 flex w-full flex-col gap-0 p-0 sm:max-w-lg"
      >
        <div className="dark:border-polar-700 flex items-center border-b border-gray-200 px-6 py-4">
          <SheetTitle className="text-base font-medium">Assistant</SheetTitle>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
          {messages.length === 0 && (
            <div className="dark:text-polar-500 flex flex-1 items-center justify-center text-sm text-gray-400">
              Ask me about your metrics
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex flex-col gap-1 ${
                message.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`text-sm ${
                  message.role === 'user'
                    ? 'dark:bg-polar-800 max-w-[85%] rounded-2xl bg-gray-100 px-4 py-2'
                    : 'prose dark:prose-invert w-full space-y-2'
                }`}
              >
                {message.parts.map((part, i) => {
                  if (part.type === 'text' && part.text.trim()) {
                    return (
                      <MemoizedMarkdown
                        key={`${message.id}-${i}`}
                        content={part.text}
                      />
                    )
                  }

                  if (
                    part.type === 'tool-show_metrics' &&
                    part.state !== 'partial-call'
                  ) {
                    const args = part.args as {
                      metrics: string[]
                      startDate: string
                      endDate: string
                      interval: schemas['TimeInterval']
                    }
                    return (
                      <MetricToolResult
                        key={`${message.id}-${i}`}
                        metrics={args.metrics}
                        startDate={args.startDate}
                        endDate={args.endDate}
                        interval={args.interval}
                        organizationId={organization.id}
                      />
                    )
                  }

                  return null
                })}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form
          onSubmit={handleSubmit}
          className="dark:border-polar-700 flex shrink-0 flex-col border-t border-gray-200"
        >
          <TextArea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={status !== 'ready'}
            placeholder="Ask about your metrics..."
            rows={1}
            className="max-h-[120px] min-h-[56px] resize-none border-none px-6 pt-4 pb-0 text-sm shadow-none focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent"
          />
          <div className="flex items-center justify-end px-4 pb-3">
            <Button
              type="submit"
              size="sm"
              disabled={status !== 'ready' || !input.trim()}
              loading={status === 'submitted' || status === 'streaming'}
            >
              Send
              <ArrowForwardOutlined className="ml-1" fontSize="inherit" />
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
