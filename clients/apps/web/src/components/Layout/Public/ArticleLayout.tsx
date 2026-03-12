import { PropsWithChildren } from 'react'

export function ArticleLayout({ children }: PropsWithChildren) {
  return (
    <div className="dark:bg-polar-950 min-h-screen bg-white text-gray-900 dark:text-white">
      <main className="prose-li:text-lg prose-p:text-lg mx-auto w-full max-w-2xl px-6 py-12 [&_img]:my-16 [&_img]:rounded-lg [&_img]:border-none [&_img]:shadow-none md:[&_img]:-mx-32 md:[&_img]:w-[calc(100%+16rem)] md:[&_img]:max-w-none">
        {children}
      </main>
    </div>
  )
}
