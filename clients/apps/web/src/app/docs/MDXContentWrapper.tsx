import { PropsWithChildren } from 'react'

export const MDXContentWrapper = ({ children }: PropsWithChildren) => {
  return (
    <div className="prose dark:prose-invert [&:not(:first-child)]:prose-headings:mt-16 prose-headings:font-semibold prose-headings:text-black prose-h1:text-4xl prose-h2:text-3xl prose-h3:text-2xl prose-h4:text-xl prose-h5:text-lg prose-h6:text-md dark:prose-headings:text-white dark:text-polar-200 max-w-4xl text-gray-800">
      {children}
    </div>
  )
}
