'use client'

import { useListArticles } from '@/hooks/queries'
import { useUserSSE } from '@/hooks/sse'
import { StickyNote2Outlined } from '@mui/icons-material'
import { Article } from '@polar-sh/sdk'
import { useEffect } from 'react'
import { useInView } from 'react-intersection-observer'
import { Post as PostComponent } from './Posts/Post'

export const Feed = () => {
  const [ref, inView] = useInView()
  const articles = useListArticles({ isPublished: true, isSubscribed: true })

  // Connect to eventstream and listen for events that may update the feed
  useUserSSE()

  const infiniteArticles =
    articles.data?.pages
      .flatMap((page) => page.items)
      .filter((item): item is Article => Boolean(item)) ?? []

  useEffect(() => {
    if (inView && articles.hasNextPage && !articles.isPending) {
      articles.fetchNextPage()
    }
  }, [inView, articles])

  if (articles.isPending) {
    return <></>
  }

  if (infiniteArticles.length === 0) {
    return (
      <div className="dark:text-polar-400 flex h-full w-full flex-col items-center gap-y-4 pt-32 text-6xl text-gray-600">
        <StickyNote2Outlined fontSize="inherit" />
        <div className="flex flex-col items-center gap-y-2">
          <h3 className="p-2 text-xl font-medium">No posts found</h3>
          <p className="dark:text-polar-500 min-w-0 truncate text-base text-gray-500">
            Newsletters from creators you subscribe to will appear here
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-y-4">
      {infiniteArticles?.map((entity) => (
        <PostComponent key={entity.id} article={entity} />
      ))}
      <div ref={ref} />
    </div>
  )
}
