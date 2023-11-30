'use client'

import LongformPost from '@/components/Feed/LongformPost'
import { PublishModalContent } from '@/components/Feed/PublishPost'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { MarkdownEditor } from '@/components/Markdown/MarkdownEditor'
import { MarkdownPreview } from '@/components/Markdown/MarkdownPreview'
import { Modal } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import Spinner from '@/components/Shared/Spinner'
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import { Article, ArticleUpdate } from '@polar-sh/sdk'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  Button,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from 'polarkit/components/ui/atoms'
import { useArticleLookup, useUpdateArticle } from 'polarkit/hooks'
import { useCallback, useEffect, useState } from 'react'

const ClientPage = () => {
  const { isShown: isModalShown, hide: hideModal, show: showModal } = useModal()
  const { post: postSlug, organization: organizationName } = useParams()
  const post = useArticleLookup(organizationName as string, postSlug as string)

  const [updateArticle, setUpdateArticle] = useState<
    ArticleUpdate & { title: string; body: string }
  >({
    title: '',
    body: '',
  })
  const [updatedArticle, setUpdatedArticle] = useState<Article>()

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

    const updated = await update.mutateAsync({
      id: post.data.id,
      articleUpdate: updateArticle,
    })

    setUpdatedArticle(updated)

    showModal()
  }, [post, update, updateArticle, showModal])

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
                <Link
                  href={`/${post.data.organization.name}/posts/${post.data.slug}`}
                  target="_blank"
                >
                  <Button className="secondary" variant={'secondary'}>
                    <ArrowTopRightOnSquareIcon className="mr-2 h-4 w-4" />
                    <span>Read</span>
                  </Button>
                </Link>
                <Button
                  className="self-start"
                  onClick={handleSave}
                  loading={update.isPending}
                >
                  Settings
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-y-3">
              <span>Title</span>
              <Input
                className="min-w-[320px]"
                placeholder="Title"
                value={updateArticle.title}
                onChange={(e) =>
                  setUpdateArticle((a) => ({
                    ...a,
                    title: e.target.value,
                  }))
                }
              />
            </div>
            <div className="flex h-full w-full flex-col">
              <Tabs
                className="flex h-full flex-col gap-y-6"
                defaultValue="edit"
              >
                <TabsList className="dark:border-polar-700 border border-gray-200">
                  <TabsTrigger value="edit">Markdown</TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                </TabsList>
                <TabsContent className="h-full" value="edit">
                  {post && (
                    <MarkdownEditor
                      value={updateArticle.body || ''}
                      onChange={(value) =>
                        setUpdateArticle((a) => ({
                          ...a,
                          body: value,
                        }))
                      }
                    />
                  )}
                </TabsContent>
                <TabsContent value="preview">
                  {post ? (
                    <div className="dark:bg-polar-800 dark:border-polar-700 flex w-full flex-col items-center rounded-3xl bg-white p-16 shadow-xl dark:border">
                      <LongformPost
                        post={{
                          ...post.data,
                          title: updateArticle.title ?? '',
                          body: updateArticle.body ?? '',
                        }}
                      />
                    </div>
                  ) : (
                    <MarkdownPreview>{updateArticle.body}</MarkdownPreview>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </DashboardBody>
      <Modal
        isShown={isModalShown}
        hide={hideModal}
        modalContent={
          updatedArticle ? (
            <PublishModalContent article={updatedArticle} hide={hideModal} />
          ) : (
            <></>
          )
        }
      />
    </>
  )
}

export default ClientPage
