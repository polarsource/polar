'use client'

import Editor from '@/components/Feed/Editor'
import { posts } from '@/components/Feed/data'
import { DashboardBody } from '@/components/Layout/MaintainerLayout'
import { useParams, useRouter } from 'next/navigation'
import { Button } from 'polarkit/components/ui/atoms'
import { useCallback, useState } from 'react'

const ClientPage = () => {
  const { post: postId, organization } = useParams()
  const post = posts.find((post) => post.slug === postId)
  const router = useRouter()
  const [value, setValue] = useState(post?.text || '')

  const handleSave = useCallback(() => {
    router.push(`/maintainer/${organization}/posts`)
  }, [router, organization])

  return (
    <>
      <DashboardBody>
        <div className="items mb-24 flex flex-row items-start gap-x-12">
          <div className="flex w-2/3 flex-col gap-y-12">
            <div className="flex w-full flex-row items-center justify-between">
              <h3 className="dark:text-polar-50 text-lg text-gray-950">
                Edit Post
              </h3>
              <Button size="sm" onClick={handleSave}>
                Save Post
              </Button>
            </div>
            <div className="flex flex-col">
              <Editor value={value} onChange={setValue} />
            </div>
          </div>
          <div className="flex w-1/3 flex-col gap-y-8">
            <div className="flex w-full flex-grow flex-row items-center justify-between">
              <h3 className="dark:text-polar-50 text-lg text-gray-950">
                Section Title
              </h3>
            </div>
          </div>
        </div>
      </DashboardBody>
    </>
  )
}

export default ClientPage
