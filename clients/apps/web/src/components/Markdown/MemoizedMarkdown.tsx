import Markdown from 'markdown-to-jsx'
import { memo } from 'react'

import { markdownOptions } from '@/utils/markdown'

export const MemoizedMarkdown = memo(
  ({ content }: { content: string }) => {
    return <Markdown options={markdownOptions}>{content}</Markdown>
  },
  (prevProps, nextProps) => prevProps.content === nextProps.content,
)

MemoizedMarkdown.displayName = 'MemoizedMarkdown'
