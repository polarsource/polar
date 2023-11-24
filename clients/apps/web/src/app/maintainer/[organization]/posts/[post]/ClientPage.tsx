'use client'

import Editor from '@/components/Feed/Editor'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import Spinner from '@/components/Shared/Spinner'
import { ArticleUpdate } from '@polar-sh/sdk'
import { useParams } from 'next/navigation'
import { Button, Input } from 'polarkit/components/ui/atoms'
import { useArticleLookup, useUpdateArticle } from 'polarkit/hooks'
import { useEffect, useState } from 'react'

const ClientPage = () => {
  const { post: postSlug, organization: organizationName } = useParams()

  const post = useArticleLookup(organizationName as string, postSlug as string)

  const [updateArticle, setUpdateArticle] = useState<ArticleUpdate>({})

  useEffect(() => {
    setUpdateArticle((a) => ({
      ...a,
      body: post.data?.body,
      title: post.data?.title,
    }))
  }, [post.data])

  const update = useUpdateArticle()

  const handleSave = async () => {
    if (!post?.data?.id) {
      return
    }

    await update.mutateAsync({
      id: post.data.id,
      articleUpdate: updateArticle,
    })
  }

  if (!post.data) {
    return (
      <DashboardBody>
        <Spinner />
      </DashboardBody>
    )
  }

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
                <Button
                  className="self-start"
                  onClick={handleSave}
                  loading={update.isPending}
                >
                  Save Post
                </Button>
              </div>
            </div>
            <Input
              className="min-w-[320px]"
              placeholder="Title"
              value={updateArticle?.title}
              onChange={(e) =>
                setUpdateArticle((a) => ({
                  ...a,
                  title: e.target.value,
                }))
              }
            />
            <div className="flex h-full w-full flex-col">
              {post && (
                <Editor
                  value={updateArticle?.body || ''}
                  onChange={(value) =>
                    setUpdateArticle((a) => ({
                      ...a,
                      body: value,
                    }))
                  }
                  post={post.data}
                />
              )}
            </div>
          </div>
        </div>
      </DashboardBody>
    </>
  )
}

export default ClientPage
