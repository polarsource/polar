'use client'

import { useRequireAuth } from '@/hooks'
import { ArrowBackOutlined } from '@mui/icons-material'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { api } from 'polarkit'
import { Button } from 'polarkit/components/ui/atoms'
import { useEffect, useState } from 'react'
import { StaggerReveal } from '../Shared/StaggerReveal'
import LongformPost from './LongformPost'
import { Post as PostComponent } from './Posts/Post'
import { Recommendation as RecommendationComponent } from './Recommendations/Recommendation'
import { Post, Recommendation, getFeed, isRecommendation } from './data'

export const Feed = () => {
  const [feed, setFeed] = useState<(Recommendation | Post)[]>([])
  const params = useSearchParams()
  const router = useRouter()
  const { currentUser } = useRequireAuth()

  useEffect(() => {
    getFeed(api, currentUser?.username || '').then((feed) => setFeed(feed))
  }, [currentUser])

  const post = feed.find(
    (post) => 'id' in post && post.id === params.get('post'),
  )

  if (post) {
    return (
      <div>
        <div>
          <Button
            size="sm"
            variant="secondary"
            className="group flex h-8 w-8 flex-col items-center justify-center rounded-full border"
            onClick={() => {
              router.back()
            }}
          >
            <ArrowBackOutlined fontSize="inherit" />
          </Button>
        </div>
        <LongformPost post={post as Post} />
      </div>
    )
  }

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
