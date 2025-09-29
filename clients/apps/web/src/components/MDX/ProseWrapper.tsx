import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

const ProseWrapper = ({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) => {
  return (
    <div
      className={twMerge(
        className,
        'prose dark:prose-invert prose-p:text-lg text-black dark:text-white',
        'prose-p:tracking-normal prose-p:leading-relaxed prose-hr:border-gray-300 dark:prose-hr:border-polar-600',
        'prose-img:rounded-lg prose-img:shadow-xs prose-img:border prose-img:border-gray-200 dark:prose-img:border-polar-800',
        'prose-headings:text-black prose-h1:text-5xl prose-h2:text-3xl prose-h3:text-2xl prose-h4:text-xl prose-h5:text-lg prose-h6:text-md dark:prose-headings:text-white prose-headings:font-medium',
        'prose-a:text-blue-500 dark:prose-a:text-blue-400 prose-a:no-underline prose-a:font-normal',
        'prose-pre:whitespace-pre-wrap dark:prose-pre:bg-polar-800 dark:prose-pre:border-polar-700 prose-pre:border prose-pre:border-transparent prose-pre:bg-gray-100 prose-pre:rounded-2xl prose-pre:text-gray-600 dark:prose-pre:text-polar-200',
        'prose-code:before:content-none prose-code:after:content-none prose-code:bg-gray-100 dark:prose-code:bg-polar-800 prose-code:font-normal prose-code:rounded-xs prose-code:px-1.5 prose-code:py-1',
      )}
    >
      {children}
    </div>
  )
}

export default ProseWrapper
