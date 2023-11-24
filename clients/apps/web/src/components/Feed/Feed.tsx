'use client'

import { useRequireAuth } from '@/hooks'
import Link from 'next/link'
import { api } from 'polarkit'
import { useEffect, useState } from 'react'
import { StaggerReveal } from '../Shared/StaggerReveal'
import { Post as PostComponent } from './Posts/Post'
import { Recommendation as RecommendationComponent } from './Recommendations/Recommendation'
import { Post, Recommendation, getFeed, isRecommendation } from './data'

export const Feed = () => {
  const [feed, setFeed] = useState<(Recommendation | Post)[]>([])
  const { currentUser } = useRequireAuth()

  useEffect(() => {
    getFeed(api, currentUser?.username || '').then((feed) => setFeed(feed))
  }, [currentUser])

  return feed.length > 0 ? (
    <StaggerReveal className="flex flex-col gap-y-6">
      {feed.map((entity) => (
        <StaggerReveal.Child key={entity.id}>
          {isRecommendation(entity) ? (
            <RecommendationComponent {...entity} />
          ) : (
            <Link href={`/posts/${entity.id}`}>
              <PostComponent {...entity} />
            </Link>
          )}
        </StaggerReveal.Child>
      ))}
    </StaggerReveal>
  ) : null
}
