'use client'

import { PostEditor } from '@/components/Feed/PostEditor'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import DashboardTopbar from '@/components/Shared/DashboardTopbar'
import Spinner from '@/components/Shared/Spinner'
import { ArrowUpRightIcon } from '@heroicons/react/24/solid'
import { ArticleUpdate } from '@polar-sh/sdk'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Button, Tabs } from 'polarkit/components/ui/atoms'
import { useArticleLookup, useUpdateArticle } from 'polarkit/hooks'
import { useCallback, useEffect, useMemo, useState } from 'react'

const ClientPage = () => {
  const { post: postSlug, organization: organizationName } = useParams()
  const post = useArticleLookup(organizationName as string, postSlug as string)
  const router = useRouter()

  const [updateArticle, setUpdateArticle] = useState<
    ArticleUpdate & { title: string; body: string }
  >({
    title: '',
    body: '',
  })

  useEffect(() => {
    setUpdateArticle((a) => ({
      ...a,
      body: post.data?.body || '',
      title: post.data?.title || '',
    }))
  }, [post.data])

  const update = useUpdateArticle()

  const handleSave = useCallback(async () => {
    if (!post?.data?.id) {
      return
    }

    await update.mutateAsync({
      id: post.data.id,
      articleUpdate: updateArticle,
    })
  }, [post, update, updateArticle])

  const handleContinue = useCallback(async () => {
    await handleSave()
    router.push(`/maintainer/${organizationName}/posts/${postSlug}/publish`)
  }, [organizationName, postSlug, handleSave])

  useEffect(() => {
    const savePost = (e: KeyboardEvent) => {
      if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleSave()
      }
    }

    window.addEventListener('keydown', savePost)

    return () => {
      window.removeEventListener('keydown', savePost)
    }
  }, [handleSave])

  const isPublished = useMemo(
    () =>
      post.data?.published_at && new Date(post.data.published_at) <= new Date(),
    [post.data],
  )

  if (!post.data) {
    return (
      <DashboardBody>
        <Spinner />
      </DashboardBody>
    )
  }

  return (
    <Tabs className="flex flex-col" defaultValue="edit">
      <DashboardTopbar title="Edit Post" isFixed useOrgFromURL>
        <div className="flex flex-row items-center gap-x-2">
          <Link
            href={`/${post.data.organization.name}/posts/${post.data.slug}`}
            target="_blank"
          >
            <Button variant="secondary">
              <span>Read</span>
              <ArrowUpRightIcon className="ml-2 h-3 w-3" />
            </Button>
          </Link>
          <Button onClick={handleContinue}>
            {isPublished ? 'Settings' : 'Continue'}
          </Button>
        </div>
      </DashboardTopbar>
      <PostEditor
        article={post.data}
        title={updateArticle.title}
        body={updateArticle.body}
        onTitleChange={(title) => setUpdateArticle((a) => ({ ...a, title }))}
        onBodyChange={(body) => setUpdateArticle((a) => ({ ...a, body }))}
        previewProps={{
          article: {
            ...post.data,
            title: updateArticle.title,
            body: updateArticle.body,
          },
        }}
      />
    </Tabs>
  )
}

export default ClientPage
