'use client'

import { PostEditor } from '@/components/Feed/PostEditor'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import DashboardTopbar from '@/components/Shared/DashboardTopbar'
import Spinner from '@/components/Shared/Spinner'
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import { ArticleUpdate } from '@polar-sh/sdk'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Button, Tabs } from 'polarkit/components/ui/atoms'
import {
  useArticleLookup,
  useDeleteArticle,
  useUpdateArticle,
} from 'polarkit/hooks'
import { useCallback, useEffect, useState } from 'react'

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

  const handlePublish = async () => {
    await handleSave()
    router.push(`/maintainer/${organizationName}/posts/${postSlug}/settings`)
  }

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

  const archive = useDeleteArticle()

  const handleArchive = async () => {
    if (!post?.data?.id) {
      return
    }

    await archive.mutateAsync({ id: post.data.id })

    router.push(`/maintainer/${post.data.organization.name}/posts`)
  }

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
          <Button
            className="self-start"
            onClick={handleArchive}
            variant={'destructive'}
            loading={archive.isPending}
          >
            Archive
          </Button>

          <Link
            href={`/${post.data.organization.name}/posts/${post.data.slug}`}
            target="_blank"
          >
            <Button variant={'outline'}>
              <ArrowTopRightOnSquareIcon className="mr-2 h-4 w-4" />
              <span>Read</span>
            </Button>
          </Link>

          <Button
            className="self-start"
            onClick={handleSave}
            variant={'secondary'}
            loading={update.isPending}
          >
            Save
          </Button>
          <Button className="self-start" onClick={handlePublish}>
            {post.data.published_at ? 'Settings' : 'Publish'}
          </Button>
        </div>
      </DashboardTopbar>
      <PostEditor
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
