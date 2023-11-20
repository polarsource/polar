'use client'

import Editor from '@/components/Feed/Editor'
import { Post, getFeed } from '@/components/Feed/data'
import { DashboardBody } from '@/components/Layout/MaintainerLayout'
import { useParams, useRouter } from 'next/navigation'
import { api } from 'polarkit'
import { Button, Input } from 'polarkit/components/ui/atoms'
import { useSubscriptionTiers } from 'polarkit/hooks'
import { useCallback, useEffect, useState } from 'react'

const ClientPage = () => {
  const { post: postId, organization } = useParams()
  const [post, setPost] = useState<Post>()
  const [body, setBody] = useState(post?.body || '')

  useEffect(() => {
    getFeed(api).then((feed) => {
      const post = feed.find(
        (post) => 'id' in post && post.id === postId,
      ) as Post

      setPost(post)
      setBody(post?.body || '')
    })
  }, [postId])

  const router = useRouter()

  const handleSave = useCallback(() => {
    router.push(`/maintainer/${organization}/posts`)
  }, [router, organization])

  const subscriptionTiers = useSubscriptionTiers(organization as string)

  return (
    <>
      <DashboardBody>
        <div className="flex h-full flex-row">
          <div className="flex h-full w-full flex-col items-start gap-y-8">
            <div className="flex w-full flex-row items-center justify-between">
              <h3 className="dark:text-polar-50 text-lg font-medium text-gray-950">
                Edit Post
              </h3>

              <div className="flex flex-row items-center gap-x-2">
                <Button className="self-start" onClick={handleSave}>
                  Save Post
                </Button>
              </div>
            </div>
            <Input className="min-w-[320px]" placeholder="Title" />
            <div className="flex h-full w-full flex-col">
              {post && <Editor value={body} onChange={setBody} post={post} />}
            </div>
          </div>
        </div>
      </DashboardBody>
    </>
  )
}

export default ClientPage
