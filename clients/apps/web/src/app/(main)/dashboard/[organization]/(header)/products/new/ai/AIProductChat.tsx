'use client'

import { useChat } from '@ai-sdk/react'
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import TextArea from '@polar-sh/ui/components/atoms/TextArea'
import { DefaultChatTransport } from 'ai'
import { nanoid } from 'nanoid'
import { useEffect, useMemo, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { ChatMessagePartRenderer, groupMessageParts } from './ChatMessageParts'

export const AIProductChat = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const conversationId = useMemo(() => nanoid(), [])

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: `/dashboard/${organization.slug}/products/new/ai/chat`,
      credentials: 'include',
      body: {
        organizationId: organization.id,
        conversationId,
      },
    }),
  })

  const hasRedirectedToManualSetup = useMemo(() => {
    return messages.some((message) =>
      message.parts.some(
        (part) =>
          part.type === 'tool-redirectToManualSetup' &&
          (part.state === 'input-available' ||
            part.state === 'output-available'),
      ),
    )
  }, [messages])

  const isFinished = useMemo(() => {
    return messages.some((message) =>
      message.parts.some(
        (part) =>
          part.type === 'tool-markAsDone' &&
          (part.state === 'input-available' ||
            part.state === 'output-available'),
      ),
    )
  }, [messages])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [input])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim()) {
      sendMessage({ text: input })
      setInput('')
      textareaRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (input.trim() && status === 'ready') {
        sendMessage({ text: input })
        setInput('')
        textareaRef.current?.focus()
      }
    }
  }

  const isChatDone = hasRedirectedToManualSetup || isFinished

  return (
    <div className="flex flex-col gap-y-4">
      <div className="dark:bg-polar-900 flex flex-col overflow-hidden rounded-3xl">
        {messages.length > 0 && (
          <div
            className={twMerge(
              'dark:border-polar-700 flex h-full max-h-[640px] flex-1 flex-col gap-y-6 overflow-y-auto rounded-t-3xl border border-gray-200 p-6',
              isChatDone ? 'rounded-b-3xl border-b' : 'border-b-0',
            )}
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex flex-col gap-y-1 ${
                  message.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`prose dark:prose-invert text-sm ${
                    message.role === 'user'
                      ? 'dark:bg-polar-800 rounded-2xl bg-gray-100 px-4 py-2 dark:text-white'
                      : 'w-full space-y-4 dark:text-white'
                  }`}
                >
                  {groupMessageParts(message.parts).map((item) => (
                    <ChatMessagePartRenderer
                      key={
                        item.type === 'group'
                          ? `${message.id}-group-${item.startIndex}`
                          : `${message.id}-${item.index}`
                      }
                      item={item}
                      messageId={message.id}
                      organization={organization}
                    />
                  ))}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} className="-mt-6" />
          </div>
        )}

        {!isChatDone && (
          <form
            onSubmit={handleSubmit}
            className="dark:border-polar-700 flex shrink-0 flex-col gap-3 overflow-hidden rounded-b-3xl border first:rounded-t-3xl"
          >
            <TextArea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={status !== 'ready'}
              placeholder={
                messages.length === 0
                  ? 'Describe your product and how you want to sell it…'
                  : 'Reply…'
              }
              rows={1}
              className="max-h-[240px] min-h-[72px] resize-none overflow-y-auto border-none px-6 pt-5 pb-0 text-sm/5 shadow-none focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none disabled:opacity-50 dark:bg-transparent"
            />
            <div className="flex items-center justify-end gap-2 px-4 pb-4">
              <Button
                type="submit"
                disabled={status !== 'ready' || !input.trim()}
                loading={status === 'submitted' || status === 'streaming'}
                className="dark:hover:bg-polar-50 rounded-full bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black"
              >
                {messages.length === 0 ? 'Create' : 'Send'}
                <ArrowForwardOutlined className="ml-2" fontSize="inherit" />
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
