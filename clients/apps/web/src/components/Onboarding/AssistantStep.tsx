'use client'

import { MemoizedMarkdown } from '@/components/Markdown/MemoizedMarkdown'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { useChat } from '@ai-sdk/react'
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined'
import Button from '@polar-sh/ui/components/atoms/Button'
import TextArea from '@polar-sh/ui/components/atoms/TextArea'
import { DefaultChatTransport } from 'ai'
import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { FadeUp } from '../Animated/FadeUp'

export const AssistantStep = ({
  onEjectToManual,
}: {
  onEjectToManual: () => void
}) => {
  const { organization } = useContext(OrganizationContext)
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: `/dashboard/${organization.slug}/onboarding/assistant/chat`,
      credentials: 'include',
      body: {
        organizationId: organization.id,
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

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [input])

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
    <FadeUp className="dark:bg-polar-900 flex flex-col gap-y-4">
      <div className="dark:border-polar-700 flex flex-col">
        {messages.length > 0 && (
          <div
            className={twMerge(
              'dark:border-polar-700 flex h-full max-h-[640px] flex-1 flex-col gap-y-6 overflow-y-auto rounded-t-3xl border border-gray-200 p-6',
              hasRedirectedToManualSetup
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
                  className={`text-sm ${
                    message.role === 'user'
                      ? 'dark:bg-polar-800 rounded-full bg-gray-100 px-4 py-2'
                      : 'prose dark:prose-invert w-full dark:text-white'
                  }`}
                >
                  {message.parts.map((part, index) => {
                    if (part.type === 'text') {
                      return (
                        <MemoizedMarkdown
                          key={`${message.id}-${index}`}
                          content={part.text}
                        />
                      )
                    }

                    if (part.type === 'reasoning') {
                      if (part.state === 'streaming') {
                        return (
                          <p
                            key={`${message.id}-${index}`}
                            className="dark:text-polar-500 animate-pulse text-sm italic text-gray-500"
                          >
                            Thinking…
                          </p>
                        )
                      }
                      return null
                    }

                    if (part.type === 'dynamic-tool') {
                      const labels = {
                        polar_products_list: {
                          input: 'Finding products…',
                          output: 'Products found.',
                          error: 'Error finding products.',
                        },
                        polar_products_create: {
                          input: 'Creating product…',
                          output: 'Product created.',
                          error: 'Error creating product.',
                        },
                        polar_products_update_benefits: {
                          input: 'Updating product benefits…',
                          output: 'Product benefits updated.',
                          error: 'Error updating product benefits.',
                        },
                        polar_benefits_list: {
                          input: 'Finding benefits…',
                          output: 'Benefits found.',
                          error: 'Error finding benefits.',
                        },
                        polar_benefits_create: {
                          input: 'Creating benefit…',
                          output: 'Benefit created.',
                          error: 'Error creating benefit.',
                        },
                        polar_benefits_update: {
                          input: 'Updating benefit…',
                          output: 'Benefit updated.',
                          error: 'Error updating benefit.',
                        },
                        polar_meters_list: {
                          input: 'Finding meters…',
                          output: 'Meters found.',
                          error: 'Error finding meters.',
                        },
                        polar_meters_create: {
                          input: 'Creating meter…',
                          output: 'Meter created.',
                          error: 'Error creating meter.',
                        },
                      }

                      switch (part.state) {
                        case 'input-streaming':
                        case 'input-available':
                          return (
                            <p
                              className="dark:text-polar-500 text-gray-500"
                              key={`${message.id}-${index}`}
                            >
                              {labels[part.toolName as keyof typeof labels]
                                ?.input ?? 'Working my magic…'}
                            </p>
                          )
                        case 'output-available': {
                          const label =
                            labels[part.toolName as keyof typeof labels]?.output

                          if (!label) {
                            return null
                          }

                          return (
                            <p
                              className="dark:text-polar-500 text-gray-500"
                              key={`${message.id}-${index}`}
                            >
                              {label}
                            </p>
                          )
                        }
                        case 'output-error':
                          return (
                            <p
                              className="dark:text-polar-500 text-gray-500"
                              key={`${message.id}-${index}`}
                            >
                              {labels[part.toolName as keyof typeof labels]
                                ?.error ?? 'Something went wrong.'}
                            </p>
                          )
                        default:
                          return null
                      }
                    }

                    if (part.type === 'tool-redirectToManualSetup') {
                      switch (part.state) {
                        case 'input-available':
                        case 'output-available':
                          switch (part.input.reason) {
                            case 'unsupported_benefit_type':
                              return (
                                <div
                                  key={`${message.id}-${index}`}
                                  className="dark:bg-polar-800 dark:text-polar-500 flex flex-col items-center gap-y-2 rounded-2xl bg-gray-100 p-4 text-gray-500"
                                >
                                  Sorry, but this configuration needs manual
                                  input.
                                  <Button
                                    variant="secondary"
                                    onClick={() => onEjectToManual()}
                                    className="dark:bg-polar-700 dark:hover:bg-polar-600 dark:border-polar-700 dark:hover:border-polar-700 border-gray-200 bg-white hover:border-gray-300 hover:bg-white"
                                  >
                                    Configure manually
                                  </Button>
                                </div>
                              )
                            case 'tool_call_error':
                              return (
                                <div
                                  key={`${message.id}-${index}`}
                                  className="dark:bg-polar-800 dark:text-polar-500 flex flex-col items-center gap-y-2 rounded-2xl bg-gray-200 p-4 text-gray-500"
                                >
                                  Sorry, something went wrong.
                                  <Button
                                    variant="secondary"
                                    onClick={() => onEjectToManual()}
                                  >
                                    Configure manually
                                  </Button>
                                </div>
                              )
                            default:
                              return null
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
          </div>
        )}

        {!hasRedirectedToManualSetup && (
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
              className="max-h-[240px] min-h-[72px] resize-none overflow-y-auto border-none px-6 pb-0 pt-5 text-sm/5 shadow-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:opacity-50 dark:bg-transparent"
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
