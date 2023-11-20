'use client'

import { api } from 'polarkit'
import { useEffect, useState } from 'react'
import { StaggerReveal } from '../Shared/StaggerReveal'
import { Post as PostComponent } from './Posts/Post'
import { Recommendation as RecommendationComponent } from './Recommendations/Recommendation'
import { Post, Recommendation, getFeed, isRecommendation } from './data'

export const Feed = () => {
  const [feed, setFeed] = useState<(Recommendation | Post)[]>([])
  useEffect(() => {
    getFeed(api).then((feed) => setFeed(feed))
  }, [])

  return feed.length > 0 ? (
    <StaggerReveal className="flex flex-col gap-y-6">
      {feed.map((entity) => (
        <StaggerReveal.Child key={entity.id}>
          {isRecommendation(entity) ? (
            <RecommendationComponent {...entity} />
          ) : (
            <PostComponent {...entity} />
          )}
        </StaggerReveal.Child>
      ))}
    </StaggerReveal>
  ) : null
}
