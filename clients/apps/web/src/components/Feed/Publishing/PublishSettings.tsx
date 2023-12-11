'use client'

import { useAuth } from '@/hooks'
import {
  Article,
  ArticleUpdateVisibilityEnum,
  ArticleVisibilityEnum,
} from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import {
  Button,
  Input,
  PolarTimeAgo,
  ShadowBoxOnMd,
} from 'polarkit/components/ui/atoms'
import { Checkbox } from 'polarkit/components/ui/checkbox'
import { Banner } from 'polarkit/components/ui/molecules'
import {
  useArticleReceivers,
  useSendArticlePreview,
  useUpdateArticle,
} from 'polarkit/hooks'
import { useEffect, useMemo, useState } from 'react'
import { PublishingTimePicker } from './PublishingTimePicker'
import { VisibilityPicker } from './VisibilityPicker'

interface PublishModalContentProps {
  article: Article
}

export const PublishSettings = ({ article }: PublishModalContentProps) => {
  const { currentUser } = useAuth()
  const [paidSubscribersOnly, setPaidSubscribersOnly] = useState(
    article.paid_subscribers_only ?? false,
  )
  const [visibility, setVisibility] = useState<ArticleUpdateVisibilityEnum>(
    article.visibility,
  )
  const [sendEmail, setSendEmail] = useState(article.notify_subscribers)
  const [previewEmailAddress, setPreviewEmailAddress] = useState('')
  const [previewSent, setPreviewSent] = useState<string>()

  const { data: articleReceivers, refetch: refetchArticleReceivers } =
    useArticleReceivers(article.organization.name, paidSubscribersOnly)

  const [publishAt, setPublishAt] = useState<Date | undefined>(
    article.published_at ? new Date(article.published_at) : undefined,
  )

  const [slug, setSlug] = useState<string>(article.slug)

  useEffect(() => {
    setPreviewEmailAddress(currentUser?.email || '')
  }, [currentUser])

  const update = useUpdateArticle()
  const sendPreview = useSendArticlePreview()

  const router = useRouter()

  const handleSendPreview = async () => {
    // visibility must be at least link to send emails
    if (visibility === ArticleVisibilityEnum.PRIVATE) {
      setVisibility(ArticleVisibilityEnum.HIDDEN)
      setDidAutoChangeVisibility(true)
    }

    await sendPreview.mutateAsync({
      id: article.id,
      email: previewEmailAddress,
    })

    setPreviewSent(previewEmailAddress)
  }

  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)

    const updated = await update.mutateAsync({
      id: article.id,
      articleUpdate: {
        paid_subscribers_only: paidSubscribersOnly,
        visibility,
        set_published_at: publishAt ? true : false,
        published_at: publishAt ? publishAt.toISOString() : undefined,
        notify_subscribers: sendEmail,
        slug,
      },
    })

    setIsSaving(false)

    router.push(`/maintainer/${updated.organization.name}/posts`)
  }

  const [didAutoChangeVisibility, setDidAutoChangeVisibility] = useState(false)

  const onChangeSendEmail = (checked: boolean) => {
    setSendEmail(checked)

    if (checked && visibility !== ArticleVisibilityEnum.PUBLIC) {
      setVisibility(ArticleVisibilityEnum.PUBLIC)
      setDidAutoChangeVisibility(true)
    }

    if (checked && publishAt === undefined) {
      setPublishAt(new Date())
    }
  }

  const onVisibilityChange = (visibility: ArticleUpdateVisibilityEnum) => {
    setVisibility(visibility)
    setDidAutoChangeVisibility(false)
  }

  const onChangePublishAt = (v: Date | undefined) => {
    setPublishAt(v)

    if (v && visibility !== ArticleVisibilityEnum.PUBLIC) {
      setVisibility(ArticleVisibilityEnum.PUBLIC)
      setDidAutoChangeVisibility(true)
    }
  }

  const onPublishAtReset = () => {
    if (article.published_at) {
      setPublishAt(new Date(article.published_at))
    } else {
      setPublishAt(undefined)
    }
  }

  const saveVerb = useMemo(() => {
    // Already published
    if (article.published_at && new Date(article.published_at) <= new Date()) {
      return 'Save'
    }

    if (publishAt && publishAt > new Date()) {
      return 'Schedule'
    }

    if (visibility === ArticleVisibilityEnum.PUBLIC) {
      return 'Publish'
    }

    return 'Save'
  }, [article, sendEmail, visibility, publishAt])

  const showNoEmailSentBanner =
    article.published_at &&
    new Date(article.published_at) < new Date() &&
    article.visibility === ArticleVisibilityEnum.PUBLIC &&
    !article.notifications_sent_at

  const formatAndSetSlug = (slug: string) => {
    slug = slug.replace(/[^a-zA-Z0-9]/g, '-').replaceAll('--', '-')
    setSlug(slug)
  }

  const visibilityDescription = useMemo(() => {
    const audience = paidSubscribersOnly
      ? 'Premium Subscribers'
      : 'All Subscribers'

    switch (visibility) {
      case ArticleVisibilityEnum.PRIVATE:
        return `Only members of ${article.organization.name} can see this post`
      case ArticleVisibilityEnum.HIDDEN:
        return `${audience} with the link can see this post`
      case ArticleVisibilityEnum.PUBLIC:
        return `${audience} can see this post on the web`
    }
  }, [visibility, paidSubscribersOnly])

  return (
    <>
      <ShadowBoxOnMd className="flex w-2/3 flex-shrink-0 flex-col gap-y-8">
        <>
          {!article.published_at && (
            <PublishingTimePicker
              publishAt={publishAt}
              article={article}
              onChange={onChangePublishAt}
              onReset={onPublishAtReset}
            />
          )}
          <AudiencePicker
            paidSubscribersOnly={paidSubscribersOnly}
            onChange={setPaidSubscribersOnly}
          />
          <VisibilityPicker
            paidSubscribersOnly={paidSubscribersOnly}
            visibility={visibility}
            privateVisibilityAllowed={!sendEmail && !publishAt}
            linkVisibilityAllowed={!sendEmail && !publishAt}
            article={article}
            onChange={onVisibilityChange}
          />
          <div className="flex flex-col gap-y-4">
            <div className="flex flex-col gap-y-2">
              <span className="font-medium">Email</span>
            </div>
            <div className="flex flex-col gap-y-4">
              {!article.notifications_sent_at ? (
                <div className="flex flex-row items-center gap-x-2">
                  <Checkbox
                    checked={sendEmail}
                    onCheckedChange={(checked) =>
                      onChangeSendEmail(Boolean(checked))
                    }
                  />
                  <span className="text-sm">
                    Send post as email to subscribers
                  </span>
                </div>
              ) : (
                <div className="flex flex-row items-center gap-x-2">
                  <Checkbox checked={true} disabled={true} />
                  <span className="text-sm">
                    This post was sent via email{' '}
                    <PolarTimeAgo
                      date={new Date(article.notifications_sent_at)}
                    />
                  </span>
                </div>
              )}

              {showNoEmailSentBanner ? (
                <Banner color="blue">
                  This article is published and public, but has not been sent
                  over email.
                </Banner>
              ) : null}

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

              {didAutoChangeVisibility && (
                <Banner color="blue">
                  The visibility has been changed to{' '}
                  <em className="capitalize">{visibility}</em>
                </Banner>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-y-4">
            <div className="flex flex-col  gap-2">
              <span className="font-medium">Slug</span>
              <p className="text-polar-500 dark:text-polar-500 text-sm">
                Change the slug of the article. The slug is used in public URLs.
              </p>
            </div>

            <Input
              type="text"
              value={slug}
              onChange={(e) => formatAndSetSlug(e.target.value)}
              className="font-mono"
              maxLength={64}
            />
          </div>
        </>
      </ShadowBoxOnMd>
      <ShadowBoxOnMd className="flex w-full flex-col gap-y-8">
        <div className="flex flex-col gap-y-2">
          <h2 className="text-lg font-medium leading-relaxed">
            {article.title}
          </h2>
          {publishAt ? (
            <span className="dark:text-polar-500 text-sm text-gray-500">
              {publishAt < new Date() ? (
                <span>
                  Published <PolarTimeAgo date={publishAt} />
                </span>
              ) : (
                <span>
                  Will be published{' '}
                  {publishAt.toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              )}
            </span>
          ) : (
            <span className="dark:text-polar-500 text-sm text-gray-500">
              Publish Now
            </span>
          )}
        </div>
        <div className="flex flex-col gap-y-4">
          <div className="flex flex-col gap-y-2">
            <h3 className="font-medium">Visibility</h3>
            <span className="dark:text-polar-50 text-sm font-medium capitalize text-gray-950">
              {visibility}
            </span>
            <p className="dark:text-polar-500 text-sm text-gray-500">
              {visibilityDescription}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-y-4">
          <h3 className="font-medium">Audience</h3>
          <ul className="dark:text-polar-500 text-sm text-gray-500">
            <li>
              <span className="font-medium">
                {articleReceivers?.free_subscribers} free subscribers
              </span>
            </li>
            <li>
              <span className="font-medium">
                {articleReceivers?.premium_subscribers} premium subscribers
              </span>
            </li>
            <li>
              <span className="font-medium">
                {articleReceivers?.organization_members} organization members
              </span>
            </li>
          </ul>
        </div>
        <div className="flex flex-col gap-y-2">
          <Button fullWidth onClick={handleSave} loading={isSaving}>
            {saveVerb}
          </Button>

          <Button fullWidth variant="secondary">
            Save Draft
          </Button>
        </div>
      </ShadowBoxOnMd>
    </>
  )
}
