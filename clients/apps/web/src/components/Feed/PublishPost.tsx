'use client'

import { ModalHeader } from '@/components/Modal'
import { useAuth } from '@/hooks'
import {
  LanguageOutlined,
  LinkOutlined,
  LockOutlined,
} from '@mui/icons-material'
import {
  Article,
  ArticleUpdateVisibilityEnum,
  ArticleVisibilityEnum,
} from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import {
  Button,
  Input,
  Tabs,
  TabsList,
  TabsTrigger,
} from 'polarkit/components/ui/atoms'
import { Checkbox } from 'polarkit/components/ui/checkbox'
import { Banner } from 'polarkit/components/ui/molecules'
import { useSendArticlePreview, useUpdateArticle } from 'polarkit/hooks'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface PublishModalContentProps {
  article: Article
  hide: () => void
}

export const PublishModalContent = ({
  article,
  hide,
}: PublishModalContentProps) => {
  const { currentUser } = useAuth()
  const [paidSubscribersOnly, setPaidSubscribersOnly] = useState(
    article.paid_subscribers_only ?? false,
  )
  const [visibility, setVisibility] = useState(article.visibility)
  const [sendEmail, setSendEmail] = useState(article.notify_subscribers)
  const [previewEmailAddress, setPreviewEmailAddress] = useState('')
  const [previewSent, setPreviewSent] = useState<string>()

  useEffect(() => {
    setPreviewEmailAddress(currentUser?.email || '')
  }, [currentUser])

  const router = useRouter()

  const update = useUpdateArticle()
  const sendPreview = useSendArticlePreview()

  const handleSendPreview = useCallback(async () => {
    await sendPreview.mutateAsync({
      id: article.id,
      email: previewEmailAddress,
    })

    setPreviewSent(previewEmailAddress)
  }, [article, previewEmailAddress, sendPreview])

  const handlePublish = useCallback(async () => {
    const updated = await update.mutateAsync({
      id: article.id,
      articleUpdate: {
        paid_subscribers_only: paidSubscribersOnly,
        visibility,
      },
    })

    router.push(`/maintainer/${updated.organization.name}/posts`)
  }, [article, update, router, paidSubscribersOnly, visibility])

  return (
    <>
      <ModalHeader className="px-8 py-4" hide={hide}>
        <h3 className="dark:text-polar-50 text-lg font-medium text-gray-950">
          {article.published_at ? 'Settings' : 'Publish Post'}
        </h3>
      </ModalHeader>
      <div className="flex flex-col gap-y-6 p-8">
        <div className="dark:border-polar-700 rounded-2xl border border-gray-100 p-6">
          <AudiencePicker
            paidSubscribersOnly={paidSubscribersOnly}
            onChange={setPaidSubscribersOnly}
          />
        </div>
        <div className="dark:border-polar-700 rounded-2xl border border-gray-100 p-6">
          <VisibilityPicker
            paidSubscribersOnly={paidSubscribersOnly}
            visibility={visibility}
            onChange={setVisibility}
          />
        </div>
        {!article.notifications_sent_at && (
          <div className="dark:border-polar-700 flex flex-col gap-y-6 rounded-2xl border border-gray-100 p-6">
            <div className="flex flex-col gap-y-4">
              <div className="flex flex-col gap-y-2">
                <span className="font-medium">Email</span>
              </div>
              <div className="flex flex-col gap-y-6">
                <div className="flex flex-row items-center gap-x-2">
                  <Checkbox
                    checked={sendEmail}
                    onCheckedChange={(checked) =>
                      setSendEmail(Boolean(checked))
                    }
                  />
                  <span className="text-sm">
                    Send post as email to subscribers
                  </span>
                </div>
                {sendEmail && (
                  <div className="flex flex-col gap-y-4">
                    <span className="text-sm font-medium">Send Preview</span>
                    <div className="flex flex-row items-center gap-x-2">
                      <Input
                        type="email"
                        placeholder="Email"
                        value={previewEmailAddress}
                        onChange={(e) => setPreviewEmailAddress(e.target.value)}
                      />
                      <Button variant="secondary" onClick={handleSendPreview}>
                        Send
                      </Button>
                    </div>
                    {previewSent && (
                      <Banner color="green">
                        Email preview sent to {previewSent}
                      </Banner>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        <div className="flex flex-row items-center justify-end gap-x-2">
          <Button variant="ghost" onClick={hide}>
            Cancel
          </Button>
          <Button onClick={handlePublish}>
            {article.published_at ? 'Save' : 'Publish'}
          </Button>
        </div>
      </div>
    </>
  )
}
interface VisibilityPickerProps {
  visibility: ArticleUpdateVisibilityEnum
  paidSubscribersOnly: boolean
  onChange: (visibility: ArticleUpdateVisibilityEnum) => void
}

const VisibilityPicker = ({
  paidSubscribersOnly,
  visibility,
  onChange,
}: VisibilityPickerProps) => {
  const visibilityDescription = useMemo(() => {
    const audience = paidSubscribersOnly
      ? 'Premium Subscribers'
      : 'All Subscribers'

    switch (visibility) {
      case ArticleVisibilityEnum.PRIVATE:
        return `Only members of this organization can see this post`
      case ArticleVisibilityEnum.HIDDEN:
        return `${audience} with the link can see this post`
      case ArticleVisibilityEnum.PUBLIC:
        return `${audience} can see this post`
    }
  }, [visibility, paidSubscribersOnly])

  const handleVisibilityChange = useCallback(
    (visibility: string) => {
      onChange(visibility as ArticleUpdateVisibilityEnum)
    },
    [onChange],
  )

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-col gap-y-2">
        <span className="font-medium">Visibility</span>
        <p className="text-polar-500 dark:text-polar-500 text-sm">
          Determines the visibility of this post for eligible subscribers
        </p>
      </div>
      <Tabs value={visibility} onValueChange={handleVisibilityChange}>
        <TabsList className="dark:border-polar-700 dark:border">
          <TabsTrigger value={ArticleVisibilityEnum.PRIVATE}>
            <LockOutlined
              className={twMerge(
                visibility === ArticleUpdateVisibilityEnum.PRIVATE &&
                  'text-blue-500 dark:text-blue-400',
              )}
              fontSize="inherit"
            />
            <span>Private</span>
          </TabsTrigger>
          <TabsTrigger value={ArticleVisibilityEnum.HIDDEN}>
            <LinkOutlined
              className={twMerge(
                visibility === ArticleUpdateVisibilityEnum.HIDDEN &&
                  'text-blue-500 dark:text-blue-400',
              )}
              fontSize="inherit"
            />
            <span>Link</span>
          </TabsTrigger>
          <TabsTrigger value={ArticleVisibilityEnum.PUBLIC}>
            <LanguageOutlined
              className={twMerge(
                visibility === ArticleUpdateVisibilityEnum.PUBLIC &&
                  'text-blue-500 dark:text-blue-400',
              )}
              fontSize="inherit"
            />
            <span>Public</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <Banner color="blue">{visibilityDescription}</Banner>
    </div>
  )
}

interface AudiencePickerProps {
  paidSubscribersOnly: boolean
  onChange: (paidSubscribersOnly: boolean) => void
}

const AudiencePicker = ({
  paidSubscribersOnly,
  onChange,
}: AudiencePickerProps) => {
  const handleAudienceChange = useCallback(
    (audience: string) => {
      onChange(audience === 'premium-subscribers')
    },
    [onChange],
  )

  const audience = useMemo(
    () => (paidSubscribersOnly ? 'premium-subscribers' : 'all-subscribers'),
    [paidSubscribersOnly],
  )

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-col gap-y-2">
        <span className="font-medium">Audience</span>
        <p className="text-polar-500 dark:text-polar-500 text-sm">
          Pick the audience for this post
        </p>
      </div>
      <Tabs value={audience} onValueChange={handleAudienceChange}>
        <TabsList className="dark:border-polar-700 dark:border">
          <TabsTrigger className="flex-col items-start" value="all-subscribers">
            <span>All Subscribers</span>
          </TabsTrigger>
          <TabsTrigger
            className="flex-col items-start"
            value="premium-subscribers"
          >
            <span>Premium Subscribers</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )
}
