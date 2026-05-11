'use client'

import { MemoizedMarkdown } from '@/components/Markdown/MemoizedMarkdown'
import type { UIMessage } from 'ai'

const POLAR_DOCS_BASE = 'https://polar.sh/docs/'

const normalizeAssistantLinks = (text: string): string =>
  text.replace(
    /\]\(([^)\s]+)(\s+"[^"]*")?\)/g,
    (match, url: string, title: string = '') => {
      if (
        /^https?:\/\//i.test(url) ||
        url.startsWith('#') ||
        url.startsWith('mailto:')
      ) {
        return match
      }
      const trimmed = url.replace(/^\/+/, '')
      // Dashboard deep-links stay relative so they resolve against the
      // current origin (dev, staging, prod, sandbox).
      if (trimmed === 'to' || trimmed.startsWith('to/')) {
        return `](/${trimmed}${title})`
      }
      // Everything else is assumed to be a docs path — make it absolute
      // since docs always live at polar.sh/docs regardless of environment.
      return `](${POLAR_DOCS_BASE}${trimmed}${title})`
    },
  )

const extractText = (message: UIMessage): string =>
  message.parts
    .filter(
      (part): part is { type: 'text'; text: string } =>
        part.type === 'text' &&
        typeof (part as { text?: unknown }).text === 'string',
    )
    .map((part) => part.text)
    .join('')

export const ChatMessageBubble = ({ message }: { message: UIMessage }) => {
  const text = extractText(message)
  if (!text) return null

  if (message.role === 'user') {
    return (
      <div className="dark:bg-polar-800 self-end rounded-2xl bg-gray-100 px-4 py-2 text-sm">
        {text}
      </div>
    )
  }

  return (
    <div className="prose prose-sm dark:prose-invert dark:text-white">
      <MemoizedMarkdown content={normalizeAssistantLinks(text)} />
    </div>
  )
}
