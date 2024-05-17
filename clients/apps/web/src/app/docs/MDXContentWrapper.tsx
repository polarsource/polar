import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

export const MDXContentWrapper = ({ children }: PropsWithChildren) => {
  return (
    <div
      className={twMerge(
        'prose dark:prose-invert dark:prose-headings:leading-normal prose-headings:leading-normal prose-headings:font-semibold prose-headings:text-black prose-h1:text-4xl prose-h2:text-3xl prose-h3:text-2xl prose-h4:text-xl prose-h5:text-lg prose-h6:text-md dark:prose-headings:text-white dark:text-polar-200 prose-img:rounded-3xl max-w-3xl text-gray-800',
        'prose-code:before:content-none prose-code:after:content-none prose-code:bg-white dark:prose-code:bg-polar-800 prose-code:font-normal prose-code:rounded-sm prose-code:px-1.5 prose-code:py-1',
        'dark:prose-pre:bg-polar-800 prose-pre:bg-white prose-pre:rounded-2xl prose-pre:text-gray-950 dark:prose-pre:text-polar-50',
      )}
    >
      {children}
    </div>
  )
}
