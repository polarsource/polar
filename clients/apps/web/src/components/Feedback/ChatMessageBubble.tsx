'use client'

import { MemoizedMarkdown } from '@/components/Markdown/MemoizedMarkdown'
import { Box } from '@polar-sh/orbit/Box'
import type { UIMessage } from 'ai'

import { extractText } from './messages'

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

export const ChatMessageBubble = ({ message }: { message: UIMessage }) => {
  const text = extractText(message)
  if (!text) return null

  if (message.role === 'user') {
    return (
      <Box
        alignSelf="end"
        backgroundColor="background-card"
        borderRadius="l"
        paddingHorizontal="l"
        paddingVertical="s"
      >
        <p className="text-sm">{text}</p>
      </Box>
    )
  }

  return (
    <div className="prose prose-sm dark:prose-invert">
      <MemoizedMarkdown content={normalizeAssistantLinks(text)} />
    </div>
  )
}
