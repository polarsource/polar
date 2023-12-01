'use client'

import { PostEditor } from '@/components/Feed/PostEditor'
import { PublishModalContent } from '@/components/Feed/PublishPost'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { Modal } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import DashboardTopbar from '@/components/Shared/DashboardTopbar'
import Spinner from '@/components/Shared/Spinner'
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import { ArticleUpdate } from '@polar-sh/sdk'
import Link from 'next/link'
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from 'next/navigation'
import { Button, Tabs } from 'polarkit/components/ui/atoms'
import { useArticleLookup, useUpdateArticle } from 'polarkit/hooks'
import { useCallback, useEffect, useState } from 'react'

const ClientPage = () => {
  const { isShown: isModalShown, hide: hideModal, show: showModal } = useModal()
  const { post: postSlug, organization: organizationName } = useParams()
  const post = useArticleLookup(organizationName as string, postSlug as string)
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [updateArticle, setUpdateArticle] = useState<
    ArticleUpdate & { title: string; body: string }
  >({
    title: '',
    body: '',
  })

  useEffect(() => {
    if (searchParams.get('settings')) {
      showModal()

      router.replace(pathname)
    }
  }, [])

  useEffect(() => {
    setUpdateArticle((a) => ({
      ...a,
      body: post.data?.body || '',
      title: post.data?.title || '',
    }))
  }, [post.data])

  const update = useUpdateArticle()

  const handleSave = useCallback(
    async (modal?: boolean) => {
      if (!post?.data?.id) {
        return
      }

      await update.mutateAsync({
        id: post.data.id,
        articleUpdate: updateArticle,
      })

      if (modal) {
        showModal()
      }
    },
    [post, update, updateArticle, showModal],
  )

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

  if (!post.data) {
    return (
      <DashboardBody>
        <Spinner />
      </DashboardBody>
    )
  }

  return (
    <Tabs className="flex h-full flex-col gap-y-6" defaultValue="edit">
      <DashboardTopbar title="Edit Post" isFixed useOrgFromURL>
        <div className="flex flex-row items-center gap-x-2">
          {post.data.visibility !== 'hidden' && (
            <Link
              href={`/${post.data.organization.name}/posts/${post.data.slug}`}
              target="_blank"
            >
              <Button className="secondary" variant={'secondary'}>
                <ArrowTopRightOnSquareIcon className="mr-2 h-4 w-4" />
                <span>Read</span>
              </Button>
            </Link>
          )}
          <Button
            className="self-start"
            onClick={() => handleSave(true)}
            loading={update.isPending}
          >
            {post.data.published_at ? 'Settings' : 'Publish'}
          </Button>
        </div>
      </DashboardTopbar>
      <PostEditor
        title={updateArticle.title}
        body={updateArticle.body}
        onTitleChange={(title) => setUpdateArticle((a) => ({ ...a, title }))}
        onBodyChange={(body) => setUpdateArticle((a) => ({ ...a, body }))}
        previewProps={{ post: post.data }}
      />
      <Modal
        isShown={isModalShown}
        hide={hideModal}
        modalContent={
          post.data ? (
            <PublishModalContent article={post.data} hide={hideModal} />
          ) : (
            <></>
          )
        }
      />
    </Tabs>
  )
}

export default ClientPage
