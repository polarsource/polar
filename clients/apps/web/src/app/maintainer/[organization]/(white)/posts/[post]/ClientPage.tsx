'use client'

import { PostEditor } from '@/components/Feed/PostEditor'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import DashboardTopbar from '@/components/Shared/DashboardTopbar'
import Spinner from '@/components/Shared/Spinner'
import { captureEvent } from '@/utils/posthog'
import { ArrowUpRightIcon } from '@heroicons/react/24/solid'
import { ArticleUpdate, ArticleVisibilityEnum } from '@polar-sh/sdk'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Button, Tabs } from 'polarkit/components/ui/atoms'
import { Banner } from 'polarkit/components/ui/molecules'
import { useArticleLookup, useUpdateArticle } from 'polarkit/hooks'
import { useCallback, useEffect, useState } from 'react'

const ClientPage = () => {
  const { post: postSlug, organization: organizationName } = useParams()
  const post = useArticleLookup(organizationName as string, postSlug as string)
  const [animateSaveBanner, setAnimateSaveBanner] = useState(false)
  const [isInSavedState, setIsInSavedState] = useState(false)

  const [updateArticle, setUpdateArticle] = useState<
    ArticleUpdate & { title: string; body: string }
  >({
    title: '',
    body: '',
  })

  useEffect(() => {
    setIsInSavedState(
      updateArticle.title === post.data?.title &&
        updateArticle.body === post.data?.body,
    )
  }, [post.data, updateArticle])

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

    try {
      await update.mutateAsync({
        id: post.data.id,
        articleUpdate: updateArticle,
      })

      setAnimateSaveBanner(true)

      setTimeout(() => {
        setAnimateSaveBanner(false)
      }, 2000)
    } catch (err) {}
  }, [post, update, updateArticle])

  useEffect(() => {
    const savePost = (e: KeyboardEvent) => {
      if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        captureEvent('posts:edit_cmd_s:submit')
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

  const isPublished = Boolean(
    post.data &&
      post.data.published_at &&
      new Date(post.data.published_at) <= new Date() &&
      post.data.visibility === ArticleVisibilityEnum.PUBLIC,
  )

  const defaultTab =
    window && window.location.hash === '#settings' ? 'settings' : 'edit'

  const onTabChange = async (tab: string) => {
    if (tab === 'settings') {
      captureEvent('posts:edit_tab_settings:view')
    } else if (tab === 'edit') {
      captureEvent('posts:edit_tab_edit:view')
    } else if (tab === 'preview') {
      captureEvent('posts:edit_tab_preview:view')
    }
  }

  return (
    <Tabs
      className="flex flex-col"
      defaultValue={defaultTab}
      onValueChange={onTabChange}
    >
      <DashboardTopbar title="Edit Post" isFixed useOrgFromURL>
        <div className="flex flex-row items-center gap-x-2">
          <span className="dark:text-polar-500 px-4 text-sm text-gray-500">
            {isPublished ? 'Published' : 'Unpublished'}
          </span>
          <Link
            href={`/${post.data.organization.name}/posts/${post.data.slug}`}
            target="_blank"
          >
            <Button variant="secondary">
              <span>Read</span>
              <ArrowUpRightIcon className="ml-2 h-3 w-3" />
            </Button>
          </Link>
          <Button
            disabled={isInSavedState}
            onClick={handleSave}
            loading={update.isPending}
          >
            Save
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
          isSubscriber: true,
          showPaywalledContent: true,
          hasPaidArticlesBenefit: true,
          animation: false,
          showShare: false,
        }}
      />
      <AnimatePresence>
        {animateSaveBanner && (
          <motion.div
            className="fixed bottom-24 left-1/2 z-10 -translate-x-1/2"
            animate={{ opacity: 1 }}
            initial={{ opacity: 0 }}
            exit={{ opacity: 0 }}
          >
            <Banner color="muted">Post was saved ✨</Banner>
          </motion.div>
        )}
      </AnimatePresence>
    </Tabs>
  )
}

export default ClientPage
