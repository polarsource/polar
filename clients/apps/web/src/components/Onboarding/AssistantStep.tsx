'use client'

import { useChat } from '@ai-sdk/react'
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined'
import { DefaultChatTransport, DynamicToolUIPart } from 'ai'
import { nanoid } from 'nanoid'
import Link from 'next/link'
import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { MemoizedMarkdown } from '@/components/Markdown/MemoizedMarkdown'
import { OrganizationContext } from '@/providers/maintainerOrganization'

import Button from '@polar-sh/ui/components/atoms/Button'
import TextArea from '@polar-sh/ui/components/atoms/TextArea'

import { FadeUp } from '../Animated/FadeUp'
import { ToolCallGroup } from './ToolCallGroup'

type MessagePart = {
  type: string
  [key: string]: unknown
}

type RenderableItem =
  | { type: 'single'; part: MessagePart; index: number }
  | { type: 'group'; parts: MessagePart[]; startIndex: number }

// Group consecutive dynamic-tool parts together
const groupMessageParts = (parts: MessagePart[]): RenderableItem[] => {
  const result: RenderableItem[] = []
  let currentGroup: MessagePart[] = []
  let groupStartIndex = 0

  parts
    .filter(({ type }) => type !== 'step-start')
    .forEach((part, index) => {
      if (part.type === 'dynamic-tool') {
        if (currentGroup.length === 0) {
          groupStartIndex = index
        }
        currentGroup.push(part)
      } else {
        // Non-dynamic-tool part breaks the group
        if (currentGroup.length > 0) {
          result.push({
            type: 'group',
            parts: currentGroup,
            startIndex: groupStartIndex,
          })
          currentGroup = []
        }
        result.push({ type: 'single', part, index })
      }
    })

  // Don't forget the last group if we ended with dynamic-tool parts
  if (currentGroup.length > 0) {
    result.push({
      type: 'group',
      parts: currentGroup,
      startIndex: groupStartIndex,
    })
  }

  return result
}

export const AssistantStep = ({
  onEjectToManual,
  onFinished,
}: {
  onEjectToManual: () => void
  onFinished: () => void
}) => {
  const { organization } = useContext(OrganizationContext)
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const conversationId = useMemo(() => nanoid(), [])

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: `/dashboard/${organization.slug}/onboarding/assistant/chat`,
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
    if (isFinished) {
      onFinished()
    }
  }, [isFinished, onFinished])

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

  return (
    <FadeUp className="flex flex-col gap-y-4">
      <div className="dark:bg-polar-900 flex flex-col overflow-hidden rounded-3xl">
        {messages.length > 0 && (
          <div
            className={twMerge(
              'dark:border-polar-700 flex h-full max-h-[640px] flex-1 flex-col gap-y-6 overflow-y-auto rounded-t-3xl border border-gray-200 p-6',
              hasRedirectedToManualSetup || isFinished
                ? 'rounded-b-3xl border-b'
                : 'border-b-0',
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
                  {groupMessageParts(message.parts).map((item) => {
                    if (item.type === 'group') {
                      return (
                        <ToolCallGroup
                          key={`${message.id}-group-${item.startIndex}`}
                          parts={item.parts as DynamicToolUIPart[]}
                          messageId={message.id}
                        />
                      )
                    }

                    const part = item.part
                    const index = item.index

                    if (part.type === 'text') {
                      return (
                        <MemoizedMarkdown
                          key={`${message.id}-${index}`}
                          content={part.text as string}
                        />
                      )
                    }

                    if (part.type === 'reasoning') {
                      if (part.state === 'streaming') {
                        return (
                          <p
                            key={`${message.id}-${index}`}
                            className="dark:text-polar-500 animate-pulse text-sm text-gray-500 italic"
                          >
                            Thinking…
                          </p>
                        )
                      }
                      return null
                    }

                    if (part.type === 'tool-redirectToManualSetup') {
                      switch (part.state) {
                        case 'input-available':
                        case 'output-available': {
                          const reason = (
                            part.input as {
                              reason:
                                | 'unsupported_benefit_type'
                                | 'tool_call_error'
                            }
                          ).reason

                          return (
                            <div
                              key={`${message.id}-${index}`}
                              className="dark:bg-polar-800 dark:text-polar-500 flex flex-col items-center gap-y-4 rounded-2xl bg-gray-100 p-4 text-center text-gray-500"
                            >
                              {reason === 'unsupported_benefit_type' ? (
                                'Sorry, but this configuration needs manual input.'
                              ) : reason === 'tool_call_error' ? (
                                'Sorry, something went wrong.'
                              ) : (
                                <>
                                  We&rsquo;re sorry this isn&rsquo;t working for
                                  you.
                                  <br />
                                  Let&rsquo;s continue manually.
                                </>
                              )}
                              <Button
                                variant="secondary"
                                className="dark:bg-polar-700 dark:hover:bg-polar-600 rounded-full border-transparent bg-white hover:bg-white dark:border-transparent"
                                onClick={() => onEjectToManual()}
                              >
                                Configure Manually
                              </Button>
                            </div>
                          )
                        }
                        default:
                          return null
                      }
                    }

                    if (part.type === 'tool-markAsDone') {
                      switch (part.state) {
                        case 'input-available':
                        case 'output-available': {
                          const productIds = (
                            (part.input as { productIds: string[] })
                              .productIds || []
                          ).join(',')

                          const nextStep = `/dashboard/${organization.slug}/onboarding/integrate?productId=${productIds}`

                          return (
                            <div
                              key={`${message.id}-${index}`}
                              className="dark:bg-polar-800 dark:text-polar-500 flex flex-col items-center gap-y-4 rounded-2xl bg-gray-100 p-4 text-center text-gray-500"
                            >
                              You&rsquo;re all set!
                              <br />
                              Now, let&rsquo;s integrate your checkout flow.
                              <Link href={nextStep}>
                                <Button className="dark:hover:bg-polar-50 rounded-full bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black">
                                  Integrate Checkout
                                </Button>
                              </Link>
                            </div>
                          )
                        }
                        default:
                          return null
                      }
                    }

                    return null
                  })}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} className="-mt-6" />
          </div>
        )}

        {!hasRedirectedToManualSetup && !isFinished && (
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
                {messages.length === 0 ? 'Setup' : 'Send'}
                <ArrowForwardOutlined className="ml-2" fontSize="inherit" />
              </Button>
            </div>
          </form>
        )}
      </div>
    </FadeUp>
  )
}
