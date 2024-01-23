'use client'

import { PostEditor } from '@/components/Feed/PostEditor'
import DashboardTopbar from '@/components/Shared/DashboardTopbar'
import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { ArticleCreate } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { Button, Tabs } from 'polarkit/components/ui/atoms'
import { useCreateArticle } from 'polarkit/hooks'
import { useState } from 'react'

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

  const handleContinue = async () => {
    if (!org || article.title.length < 1) {
      return
    }

    const created = await create.mutateAsync({
      ...article,
      organization_id: org.id,
    })

    router.replace(
      `/maintainer/${created.organization.name}/posts/${created.slug}`,
    )
  }

  if (!org) {
    return null
  }

  return (
    <Tabs className="flex flex-col" defaultValue="edit">
      <DashboardTopbar title="Create Post" isFixed useOrgFromURL>
        <Button onClick={handleContinue} disabled={article.title.length < 1}>
          Save
        </Button>
      </DashboardTopbar>
      <PostEditor
        title={article.title}
        body={article.body}
        onTitleChange={(title) => setArticle((a) => ({ ...a, title }))}
        onBodyChange={(body) => setArticle((a) => ({ ...a, body }))}
        previewProps={{
          article: {
            ...article,
            organization: org,
            byline: org,
            slug: 'preview',
            is_preview: false,
          },
          isSubscriber: true,
          showPaywalledContent: true,
          animation: false,
          showShare: false,
          hasPaidArticlesBenefit: true,
        }}
      />
    </Tabs>
  )
}

export default ClientPage
