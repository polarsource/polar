'use client'

import { markdownOptions } from '@/utils/markdown'
import Markdown from 'markdown-to-jsx'
import { memo } from 'react'

export const MemoizedMarkdown = memo(
  ({ content, className }: { content: string; className?: string }) => {
    return (
      <Markdown options={markdownOptions} className={className}>
        {content}
      </Markdown>
    )
  },
  (prevProps, nextProps) => prevProps.content === nextProps.content,
)

MemoizedMarkdown.displayName = 'MemoizedMarkdown'
