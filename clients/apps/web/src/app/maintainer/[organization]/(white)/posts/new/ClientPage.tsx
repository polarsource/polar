'use client'

import { PostEditor } from '@/components/Feed/PostEditor'
import DashboardTopbar from '@/components/Navigation/DashboardTopbar'
import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { captureEvent } from '@/utils/posthog'
import { ArticleCreate } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { Button, Tabs } from 'polarkit/components/ui/atoms'
import { useCreateArticle } from 'polarkit/hooks'
import { useEffect, useState } from 'react'

const ClientPage = () => {
  const { org } = useCurrentOrgAndRepoFromURL()
  const [tab, setTab] = useState('edit')

  const [article, setArticle] = useState<
    Omit<ArticleCreate, 'organization_id'>
  >({
    title: '',
    body: '',
  })

  const router = useRouter()
  const create = useCreateArticle()

  const canCreate = org && article.title.length > 0

  const handleContinue = async () => {
    if (!canCreate) {
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

  useEffect(() => {
    const keyHandler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === 's') {
          e.preventDefault()
          captureEvent('posts:create_cmd_s:create')
          handleContinue()
        }
        if (e.key === 'p') {
          e.preventDefault()
          captureEvent('posts:create_cmd_p:view')
          setTab('preview')
        }
      }
    }

    window.addEventListener('keydown', keyHandler)

    return () => {
      window.removeEventListener('keydown', keyHandler)
    }
  }, [handleContinue])

  const onTabChange = async (tab: string) => {
    setTab(tab)

    if (tab === 'settings') {
      if (!canCreate) {
        return
      }

      captureEvent('posts:create_publish_tab:create')

      const created = await create.mutateAsync({
        ...article,
        organization_id: org.id,
      })

      router.replace(
        `/maintainer/${created.organization.name}/posts/${created.slug}#settings`,
      )
    } else if (tab === 'edit') {
      captureEvent('posts:create_tab_edit:view')
    } else if (tab === 'preview') {
      captureEvent('posts:create_tab_preview:view')
    }
  }

  if (!org) {
    return null
  }

  return (
    <Tabs className="flex flex-col" value={tab} onValueChange={onTabChange}>
      <DashboardTopbar title="Create Post" isFixed useOrgFromURL>
        <Button
          onClick={() => {
            captureEvent('posts:create_save_button:create')
            handleContinue()
          }}
          disabled={article.title.length < 1}
          loading={create.isPending}
        >
          Save
        </Button>
      </DashboardTopbar>
      <PostEditor
        disabled={create.isPending}
        canCreate={canCreate}
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
          isAuthor: true,
        }}
      />
    </Tabs>
  )
}

export default ClientPage
