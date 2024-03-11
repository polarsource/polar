'use client'

import { PostEditor } from '@/components/Feed/PostEditor'
import DashboardTopbar from '@/components/Navigation/DashboardTopbar'
import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { captureEvent } from '@/utils/posthog'
import { useRouter } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import { Tabs } from 'polarkit/components/ui/atoms/tabs'
import { useCreateArticle } from 'polarkit/hooks'
import { useEffect, useState } from 'react'

const ClientPage = () => {
  const { org } = useCurrentOrgAndRepoFromURL()
  const [tab, setTab] = useState('edit')

  const [localArticle, setLocalArticle] = useState<{
    title: string
    body: string
  }>({
    title: '',
    body: '',
  })

  const router = useRouter()
  const create = useCreateArticle()

  const canCreate = org && localArticle.title.length > 0

  const handleContinue = async () => {
    if (!canCreate) {
      return
    }

    const created = await create.mutateAsync({
      ...localArticle,
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
        ...localArticle,
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
          disabled={localArticle.title.length < 1}
          loading={create.isPending}
        >
          Save
        </Button>
      </DashboardTopbar>
      <PostEditor
        disabled={create.isPending}
        canCreate={canCreate}
        title={localArticle.title}
        body={localArticle.body}
        onTitleChange={(title) => setLocalArticle((a) => ({ ...a, title }))}
        onBodyChange={(body) => setLocalArticle((a) => ({ ...a, body }))}
        previewProps={{
          article: {
            ...localArticle,
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
