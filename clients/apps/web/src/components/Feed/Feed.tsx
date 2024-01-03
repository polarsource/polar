'use client'

import { ViewDayOutlined } from '@mui/icons-material'
import Link from 'next/link'
import { useListArticles } from 'polarkit/hooks'
import { StaggerReveal } from '../Shared/StaggerReveal'
import { Post as PostComponent } from './Posts/Post'

export const Feed = () => {
  const articles = useListArticles()

  if (!articles.data || !articles.data.items) {
    return <></>
  }

  return articles.data.items.length > 0 ? (
    <StaggerReveal className="flex flex-col gap-y-4">
      {articles.data.items.map((entity) => (
        <StaggerReveal.Child key={entity.id}>
          <Link href={`/${entity.organization.name}/posts/${entity.slug}`}>
            <PostComponent article={entity} />
          </Link>
        </StaggerReveal.Child>
      ))}
    </StaggerReveal>
  ) : (
    <div className="dark:text-polar-400 flex h-full flex-col items-center gap-y-4 pt-32 text-gray-600">
      <ViewDayOutlined fontSize="large" />
      <div className="flex flex-col items-center gap-y-2">
        <h3 className="p-2 text-lg font-medium">No Posts yet</h3>
        <p className="dark:text-polar-500 min-w-0 truncate text-gray-500">
          Posts from creators you subscribe to will appear here
        </p>
      </div>
    </div>
  )
}
