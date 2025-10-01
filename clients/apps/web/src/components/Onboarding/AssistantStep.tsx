'use client'

import { MemoizedMarkdown } from '@/components/Markdown/MemoizedMarkdown'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { useChat } from '@ai-sdk/react'
import Button from '@polar-sh/ui/components/atoms/Button'
import { DefaultChatTransport } from 'ai'
import { motion } from 'framer-motion'
import { useContext, useState } from 'react'
import { FadeUp } from '../Animated/FadeUp'
import LogoIcon from '../Brand/LogoIcon'

export const AssistantStep = () => {
  const { organization } = useContext(OrganizationContext)
  const [input, setInput] = useState('')

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: `/dashboard/${organization.slug}/onboarding/assistant/chat`,
      credentials: 'include',
    }),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim()) {
      sendMessage({ text: input })
      setInput('')
    }
  }

  return (
    <div className="dark:md:bg-polar-950 flex flex-col pt-16 md:items-center md:p-16">
      <motion.div
        initial="hidden"
        animate="visible"
        transition={{ duration: 1, staggerChildren: 0.3 }}
        className="flex min-h-0 w-full shrink-0 flex-col gap-12 md:max-w-xl md:p-8"
      >
        <FadeUp className="flex flex-col items-center gap-y-8">
          <LogoIcon size={50} />
          <div className="flex flex-col gap-y-4">
            <h1 className="text-center text-3xl">
              Start selling in two minutes
            </h1>
            <p className="dark:text-polar-400 text-center text-lg text-gray-600">
              Describe your product &amp; we&rsquo;ll handle the rest.
            </p>
          </div>
        </FadeUp>

        <div className="flex flex-col md:gap-y-4">
          <FadeUp className="dark:bg-polar-900 flex flex-col gap-y-4">
            <div className="dark:border-polar-700 flex flex-col">
              {messages.length > 0 && (
                <div className="dark:border-polar-700 flex h-full max-h-[640px] flex-1 flex-col gap-y-3 overflow-y-auto rounded-t-3xl border border-b-0 border-gray-200 p-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex flex-col gap-y-1 ${
                        message.role === 'user' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`${
                          message.role === 'user'
                            ? 'rounded-2xl bg-blue-600 px-4 py-2 text-white'
                            : 'prose dark:prose-invert dark:bg-polar-800 dark:text-white'
                        }`}
                      >
                        {message.parts.map((part, index) => {
                          if (part.type === 'text') {
                            return (
                              <MemoizedMarkdown
                                key={index}
                                content={part.text}
                              />
                            )
                          }

                          if (part.type === 'tool-redirectToManualSetup') {
                            switch (part.state) {
                              case 'output-available':
                                return (
                                  <p>
                                    This configuration needs manual input.
                                    Please configure the product manually.
                                  </p>
                                )
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

              <form
                onSubmit={handleSubmit}
                className="dark:border-polar-700 flex shrink-0 items-end gap-2 overflow-hidden rounded-b-3xl border pr-4 first:rounded-t-3xl focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100"
              >
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={status !== 'ready'}
                  placeholder={
                    messages.length === 0
                      ? 'Describe your product and how you want to sell it…'
                      : 'Reply to Polar'
                  }
                  className="dark:bg-polar-800 h-18 pt-6.5 flex-1 resize-none border-none px-4 text-sm/5 focus:outline-none focus:ring-0 disabled:opacity-50"
                />
                <div className="py-4">
                  <Button
                    type="submit"
                    disabled={status !== 'ready' || !input.trim()}
                    loading={status === 'streaming'}
                  >
                    {messages.length === 0 ? 'Start selling' : 'Send'}
                  </Button>
                </div>
              </form>
            </div>
          </FadeUp>
        </div>
      </motion.div>
    </div>
  )
}
