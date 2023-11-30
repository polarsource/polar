'use client'

import { PostToolbar } from '@/components/Feed/PostToolbar'
import { PublishModalContent } from '@/components/Feed/PublishPost'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { MarkdownEditor } from '@/components/Markdown/MarkdownEditor'
import { MarkdownPreview } from '@/components/Markdown/MarkdownPreview'
import { Modal } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import DashboardTopbar from '@/components/Shared/DashboardTopbar'
import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { Article, ArticleCreate } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { Button, Tabs, TabsContent } from 'polarkit/components/ui/atoms'
import { useCreateArticle } from 'polarkit/hooks'
import { useCallback, useEffect, useState } from 'react'

const ManagePost = () => {
  const { org } = useCurrentOrgAndRepoFromURL()
  const { isShown: isModalShown, hide: hideModal, show: showModal } = useModal()

  const [createdArticle, setCreatedArticle] = useState<Article>()

  const [article, setArticle] = useState<ArticleCreate>({
    title: '',
    body: '',
    organization_id: org?.id || '',
  })

  useEffect(() => {
    setArticle((a) => ({ ...a, organization_id: org?.id || '' }))
  }, [org])

  const router = useRouter()
  const create = useCreateArticle()

  const handleSave = useCallback(async () => {
    if (!org) {
      return
    }

    const created = await create.mutateAsync(article)

    router.push(
      `/maintainer/${created.organization.name}/posts/${created.slug}`,
    )
  }, [article, create, org, router])

  const handleContinue = useCallback(async () => {
    if (!org) {
      return
    }

    if (!createdArticle) {
      const created = await create.mutateAsync(article)

      setCreatedArticle(created)
    }

    showModal()
  }, [article, create, org, showModal, createdArticle])

  return (
    <Tabs className="flex h-full flex-col gap-y-6" defaultValue="edit">
      <DashboardTopbar title="Create Post" isFixed useOrgFromURL>
        <div className="flex flex-row items-center gap-x-2">
          <Button
            variant="ghost"
            onClick={handleSave}
            loading={create.isPending}
          >
            Save Draft
          </Button>
          <Button onClick={handleContinue}>Continue</Button>
        </div>
      </DashboardTopbar>
      <PostToolbar />
      <div className="dark:bg-polar-950 h-full bg-white pt-24">
        <DashboardBody className="h-full">
          <div className="flex h-full flex-row">
            <div className="flex h-full w-full flex-col">
              <TabsContent
                className="flex h-full flex-col gap-y-8"
                value="edit"
                tabIndex={-1}
              >
                <input
                  className="transparent dark:placeholder:text-polar-500 min-w-full border-none bg-transparent text-3xl font-medium shadow-none outline-none"
                  autoFocus
                  placeholder="Title"
                  value={article.title}
                  onChange={(e) =>
                    setArticle((a) => ({ ...a, title: e.target.value }))
                  }
                />
                <MarkdownEditor
                  className="focus:ring-none dakr:shadow-none h-full overflow-visible rounded-none border-none bg-transparent p-0 outline-none dark:bg-transparent dark:outline-none dark:focus:ring-transparent"
                  value={article.body}
                  onChange={(val) => setArticle((a) => ({ ...a, body: val }))}
                />
              </TabsContent>
              <TabsContent value="preview">
                <MarkdownPreview className="h-full">
                  {article.body}
                </MarkdownPreview>
              </TabsContent>
            </div>
          </div>
          <Modal
            isShown={isModalShown}
            hide={hideModal}
            modalContent={
              createdArticle ? (
                <PublishModalContent
                  article={createdArticle}
                  hide={hideModal}
                />
              ) : (
                <></>
              )
            }
          />
        </DashboardBody>
      </div>
    </Tabs>
  )
}

export default ManagePost
