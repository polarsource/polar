'use client'

import { OrganizationContext } from '@/providers/maintainerOrganization'
import { useChat } from '@ai-sdk/react'
import Button from '@polar-sh/ui/components/atoms/Button'
import { DefaultChatTransport } from 'ai'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useContext, useState } from 'react'
import { FadeUp } from '../Animated/FadeUp'
import LogoIcon from '../Brand/LogoIcon'

export const AssistantStep = () => {
  const { organization } = useContext(OrganizationContext)
  const [input, setInput] = useState('')

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: `/dashboard/${organization.slug}/onboarding/assistant/chat`,
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
            <h1 className="text-center text-3xl">AI Setup Assistant</h1>
            <p className="dark:text-polar-400 text-center text-lg text-gray-600">
              Describe your business and let AI help configure your account.
            </p>
          </div>
        </FadeUp>

        <div className="flex flex-col md:gap-y-4">
          <FadeUp className="dark:bg-polar-900 flex flex-col gap-y-4 rounded-3xl border-gray-200 bg-white p-6 md:border dark:border-none">
            <div className="flex flex-col gap-y-4">
              <div className="flex min-h-[400px] flex-col gap-y-3 overflow-y-auto">
                {messages.length === 0 ? (
                  <p className="dark:text-polar-400 text-sm text-gray-600">
                    Start by telling us about your business...
                  </p>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex flex-col gap-y-1 ${
                        message.role === 'user' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <span
                        className={`text-xs font-medium ${
                          message.role === 'user'
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'dark:text-polar-400 text-gray-600'
                        }`}
                      >
                        {message.role === 'user' ? 'You' : 'Assistant'}
                      </span>
                      <div
                        className={`rounded-2xl px-4 py-2 ${
                          message.role === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'dark:bg-polar-800 bg-gray-100 dark:text-white'
                        }`}
                      >
                        {message.parts.map((part, index) =>
                          part.type === 'text' ? (
                            <span key={index}>{part.text}</span>
                          ) : null,
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={status !== 'ready'}
                  placeholder="Type your message..."
                  className="dark:bg-polar-800 dark:border-polar-700 flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
                <Button
                  type="submit"
                  disabled={status !== 'ready' || !input.trim()}
                  loading={status === 'streaming'}
                >
                  Send
                </Button>
              </form>
            </div>
          </FadeUp>

          <FadeUp className="flex flex-col gap-y-2 p-8 md:p-0">
            <Link href={`/dashboard/${organization.slug}/onboarding/product`}>
              <Button className="w-full" size="lg" variant="secondary">
                Skip to manual setup
              </Button>
            </Link>
          </FadeUp>
        </div>
      </motion.div>
    </div>
  )
}
