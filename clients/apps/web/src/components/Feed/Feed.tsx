'use client'

import { api } from 'polarkit'
import { useEffect, useState } from 'react'
import { Post as PostComponent } from './Posts/Post'
import { Recommendation as RecommendationComponent } from './Recommendations/Recommendation'
import { Post, Recommendation, getFeed, isRecommendation } from './data'

export const Feed = () => {
  const [feed, setFeed] = useState<(Recommendation | Post)[]>([])
  useEffect(() => {
    getFeed(api).then((feed) => setFeed(feed))
  }, [])

  return (
    <div className="flex flex-col gap-y-2">
      {feed.map((entity) =>
        isRecommendation(entity) ? (
          <RecommendationComponent key={entity.id} {...entity} />
        ) : (
          <PostComponent key={entity.slug} {...entity} />
        ),
      )}
    </div>
  )
}
