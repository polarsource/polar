'use client'

import { ViewDayOutlined } from '@mui/icons-material'
import { Article } from '@polar-sh/sdk'
import { useListArticles, useSSE } from 'polarkit/hooks'
import { useEffect } from 'react'
import { useInView } from 'react-intersection-observer'
import { StaggerReveal } from '../Shared/StaggerReveal'
import { Post as PostComponent } from './Posts/Post'

export const Feed = () => {
  const [ref, inView] = useInView()
  const articles = useListArticles()

  // Connect to eventstream and listen for events that may update the feed
  useSSE()

  const infiniteArticles =
    articles.data?.pages
      .flatMap((page) => page.items)
      .filter((item): item is Article => Boolean(item)) ?? []

  useEffect(() => {
    if (inView && articles.hasNextPage) {
      articles.fetchNextPage()
    }
  }, [inView, articles])

  if (articles.isPending) {
    return <></>
  }

  if (infiniteArticles.length === 0) {
    return (
      <div className="dark:text-polar-400 flex h-full flex-col items-center gap-y-4 pt-32 text-gray-600">
        <ViewDayOutlined fontSize="large" />
        <div className="flex flex-col items-center gap-y-2">
          <h3 className="p-2 text-lg font-medium">No posts found</h3>
          <p className="dark:text-polar-500 min-w-0 truncate text-gray-500">
            Posts from creators you subscribe to will appear here
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-y-4">
      <StaggerReveal className="flex flex-col gap-y-4">
        {infiniteArticles?.map((entity) => (
          <StaggerReveal.Child key={entity.id}>
            <PostComponent article={entity} />
          </StaggerReveal.Child>
        ))}
      </StaggerReveal>
      <div ref={ref} />
    </div>
  )
}
