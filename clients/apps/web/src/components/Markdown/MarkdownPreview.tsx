// @ts-ignore
import Markdown, { Options } from 'react-markdown'
import { twMerge } from 'tailwind-merge'
import { COMPONENTS } from './MarkdownComponents'

export const MarkdownPreview = (props: Options) => {
  return (
    <Markdown
      {...props}
      className={twMerge('relative w-full leading-relaxed', props.className)}
      components={COMPONENTS}
    />
  )
}
