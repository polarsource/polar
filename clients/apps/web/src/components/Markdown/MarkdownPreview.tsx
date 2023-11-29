// @ts-ignore

import { twMerge } from 'tailwind-merge'

// @ts-ignore
import Markdown from 'markdown-to-jsx'
import { markdownOpts } from '../Feed/Posts/markdown'

export const MarkdownPreview = (props: {
  body: string
  className?: string
}) => {
  return (
    <Markdown
      className={twMerge('relative w-full leading-relaxed', props.className)}
      // @ts-ignore
      options={{ ...markdownOpts }}
    >
      {props.body}
    </Markdown>
  )
}
