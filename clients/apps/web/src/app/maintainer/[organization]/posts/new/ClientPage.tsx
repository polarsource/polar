'use client'

import { PublishModalContent } from '@/components/Feed/PublishPost'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { MarkdownEditor } from '@/components/Markdown/MarkdownEditor'
import { MarkdownPreview } from '@/components/Markdown/MarkdownPreview'
import { Modal } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { Article, ArticleCreate } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import {
  Button,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from 'polarkit/components/ui/atoms'
import { useCreateArticle } from 'polarkit/hooks'
import { useCallback, useEffect, useState } from 'react'

const ClientPage = () => {
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
    <>
      <DashboardBody>
        <div className="flex h-full flex-row">
          <div className="flex h-full w-full flex-col items-start gap-y-8">
            <div className="flex w-full flex-row items-center justify-between">
              <h3 className="dark:text-polar-50 text-lg font-medium text-gray-950">
                Create Post
              </h3>

              <div className="flex flex-row items-center gap-x-4">
                <Button
                  variant="secondary"
                  onClick={handleSave}
                  loading={create.isPending}
                >
                  Save Draft
                </Button>
                <Button onClick={handleContinue}>Continue</Button>
              </div>
            </div>
            <Input
              className="min-w-[320px]"
              placeholder="Title"
              value={article.title}
              onChange={(e) =>
                setArticle((a) => ({ ...a, title: e.target.value }))
              }
            />
            <div className="flex h-full w-full flex-col">
              <Tabs
                className="flex h-full flex-col gap-y-6"
                defaultValue="edit"
              >
                <TabsList className="dark:border-polar-700 dark:border">
                  <TabsTrigger value="edit">Markdown</TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                </TabsList>
                <TabsContent className="h-full" value="edit" tabIndex={-1}>
                  <MarkdownEditor
                    value={article.body}
                    onChange={(val) => setArticle((a) => ({ ...a, body: val }))}
                  />
                </TabsContent>
                <TabsContent value="preview">
                  <MarkdownPreview body={article.body} />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
        <Modal
          isShown={isModalShown}
          hide={hideModal}
          modalContent={
            createdArticle ? (
              <PublishModalContent article={createdArticle} hide={hideModal} />
            ) : (
              <></>
            )
          }
        />
      </DashboardBody>
    </>
  )
}

export default ClientPage
