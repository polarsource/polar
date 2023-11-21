'use client'

import LongformPost from '@/components/Feed/LongformPost'
import { Post, Recommendation, getFeed } from '@/components/Feed/data'
import { useRequireAuth } from '@/hooks'
import { ArrowBackOutlined } from '@mui/icons-material'
import Link from 'next/link'
import { api } from 'polarkit'
import { Button } from 'polarkit/components/ui/atoms'
import { useEffect, useState } from 'react'

export default function Page({ params }: { params: { postId: string } }) {
  const { currentUser } = useRequireAuth()

  const [post, setPost] = useState<Post | Recommendation | undefined>()

  useEffect(() => {
    if (!currentUser?.username) {
      setPost(undefined)
      return
    }

    getFeed(api, currentUser.username).then((feed) => {
      const post = feed.find(
        (post) => 'id' in post && post.id === params.postId,
      )
      setPost(post)
    })
  }, [currentUser, params.postId])

  return (
    <div className="dark:bg-polar-800 dark:border-polar-700 relative my-16 flex flex-row items-start rounded-3xl bg-white p-12 shadow-lg dark:border">
      <Link className="absolute left-16 top-16 flex-shrink" href="/posts">
        <Button
          size="sm"
          variant="secondary"
          className="group flex h-8 w-8 flex-col items-center justify-center rounded-full border"
        >
          <ArrowBackOutlined fontSize="inherit" />
        </Button>
      </Link>
      <div className="flex w-full flex-grow flex-col items-center gap-y-8 pb-12">
        {post ? <LongformPost post={post as Post} /> : null}
      </div>
    </div>
  )
}
