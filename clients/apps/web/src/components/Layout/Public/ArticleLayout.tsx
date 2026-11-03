import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

export function ArticleLayout({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <div className="dark:bg-polar-950 min-h-screen max-w-full min-w-0 bg-white text-gray-900 dark:text-white">
      <main
        className={twMerge(
          'prose-li:text-lg prose-p:text-lg mx-auto w-full max-w-2xl py-12 [&_img]:my-16 [&_img]:rounded-lg [&_img]:border-none [&_img]:shadow-none md:[&_img]:-mx-32 md:[&_img]:w-[calc(100%+16rem)] md:[&_img]:max-w-none',
          className,
        )}
      >
        {children}
      </main>
    </div>
  )
}
