'use client'

import { PostEditor } from '@/components/Feed/PostEditor'
import DashboardTopbar from '@/components/Shared/DashboardTopbar'
import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { ArticleCreate } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { Button, Tabs } from 'polarkit/components/ui/atoms'
import { useCreateArticle } from 'polarkit/hooks'
import { useCallback, useEffect, useState } from 'react'

const ClientPage = () => {
  const { org } = useCurrentOrgAndRepoFromURL()

  const [article, setArticle] = useState<
    Omit<ArticleCreate, 'organization_id'>
  >({
    title: '',
    body: '',
  })

  const router = useRouter()
  const create = useCreateArticle()

  const handleContinue = useCallback(
    async (openModal?: boolean) => {
      if (!org) {
        return
      }

      const created = await create.mutateAsync({
        ...article,
        organization_id: org.id,
      })

      if (openModal) {
        router.push(
          `/maintainer/${created.organization.name}/posts/${created.slug}?settings=true`,
        )
      } else {
        router.push(
          `/maintainer/${created.organization.name}/posts/${created.slug}`,
        )
      }
    },
    [article, create, org, router],
  )

  useEffect(() => {
    const savePost = (e: KeyboardEvent) => {
      if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleContinue()
      }
    }

    window.addEventListener('keydown', savePost)

    return () => {
      window.removeEventListener('keydown', savePost)
    }
  }, [handleContinue])

  if (!org) {
    return null
  }

  return (
    <Tabs className="flex h-full flex-col gap-y-6" defaultValue="edit">
      <DashboardTopbar title="Create Post" isFixed useOrgFromURL>
        <div className="flex flex-row items-center gap-x-2">
          <Button
            onClick={() => handleContinue(true)}
            disabled={article.title.length < 1}
            loading={create.isPending}
          >
            Continue
          </Button>
        </div>
      </DashboardTopbar>
      <PostEditor
        title={article.title}
        body={article.body}
        onTitleChange={(title) => setArticle((a) => ({ ...a, title }))}
        onBodyChange={(body) => setArticle((a) => ({ ...a, body }))}
        previewProps={{ post: { ...article, organization: org, byline: org } }}
      />
    </Tabs>
  )
}

export default ClientPage
