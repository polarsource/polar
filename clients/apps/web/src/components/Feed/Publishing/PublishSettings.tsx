'use client'

import { useModal } from '@/components/Modal/useModal'
import { ConfirmModal } from '@/components/Shared/ConfirmModal'
import { Article } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { Button, Input, ShadowBoxOnMd } from 'polarkit/components/ui/atoms'
import { Checkbox } from 'polarkit/components/ui/checkbox'
import { useDeleteArticle } from 'polarkit/hooks'
import { useCallback, useMemo, useState } from 'react'
import { AudiencePicker } from './AudiencePicker'
import { PublishSummary } from './PublishSummary'
import { PublishingTimePicker } from './PublishingTimePicker'

interface PublishModalContentProps {
  article: Article
}

export const PublishSettings = ({ article }: PublishModalContentProps) => {
  const [paidSubscribersOnly, setPaidSubscribersOnly] = useState(
    article.paid_subscribers_only ?? false,
  )
  const [sendEmail, setSendEmail] = useState(article.notify_subscribers)
  const [publishAt, setPublishAt] = useState<Date | undefined>(
    article.published_at ? new Date(article.published_at) : undefined,
  )
  const [slug, setSlug] = useState<string>(article.slug)
  const router = useRouter()
  const { hide: hideModal, isShown: isModalShown, show: showModal } = useModal()

  const onChangeSendEmail = (checked: boolean) => {
    setSendEmail(checked)
  }

  const onChangePublishAt = (v: Date | undefined) => {
    setPublishAt(v)
  }

  const archiveArticle = useDeleteArticle()

  const handleArchiveArticle = useCallback(async () => {
    const response = await archiveArticle.mutateAsync({ id: article.id })

    if (response.ok) {
      router.push(`/maintainer/${article.organization.name}/posts`)
    } else {
      hideModal()
    }
  }, [archiveArticle, article, hideModal, router])

  const formatAndSetSlug = useCallback(
    (slug: string) => {
      setSlug(slug.replace(/[^a-zA-Z0-9]/g, '-').replaceAll('--', '-'))
    },
    [setSlug],
  )

  const isPublished = useMemo(
    () =>
      article.published_at
        ? new Date(article.published_at) <= new Date()
        : false,
    [article],
  )

  return (
    <>
      <div className="flex w-2/3 flex-shrink-0 flex-col gap-y-8">
        <ShadowBoxOnMd className="flex flex-col gap-y-8">
          <>
            {!isPublished && (
              <PublishingTimePicker
                publishAt={publishAt}
                article={article}
                onChange={onChangePublishAt}
              />
            )}
            <AudiencePicker
              paidSubscribersOnly={paidSubscribersOnly}
              onChange={setPaidSubscribersOnly}
            />
            {!article.notifications_sent_at && (
              <>
                <div className="flex flex-col gap-y-4">
                  <div className="flex flex-col gap-y-2">
                    <span className="font-medium">Email</span>
                    <p className="text-polar-500 dark:text-polar-500 text-sm">
                      Sent to subscribers when a post is published
                    </p>
                  </div>
                  <div className="flex flex-col gap-y-4">
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
                  </div>
                </div>
              </>
            )}
            <div className="flex flex-col gap-y-4">
              <div className="flex flex-col  gap-2">
                <span className="font-medium">Slug</span>
                <p className="text-polar-500 dark:text-polar-500 text-sm">
                  Change the slug of the article. The slug is used in public
                  URLs.
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
        <ShadowBoxOnMd className="flex flex-col gap-y-8">
          <div className="flex flex-row items-start justify-between">
            <div className="flex flex-col gap-y-1">
              <h3 className="dark:text-polar-50 font-medium text-gray-950">
                Archive
              </h3>
              <p className="dark:text-polar-500 text-sm text-gray-500">
                This action will unpublish the post & permanently remove it
              </p>
            </div>
            <Button variant="destructive" size="sm" onClick={showModal}>
              Archive
            </Button>
          </div>
          <ConfirmModal
            title="Archive Post"
            description={
              'This action will unpublish the post & permanently remove it.'
            }
            destructiveText="Archive"
            onConfirm={handleArchiveArticle}
            isShown={isModalShown}
            hide={hideModal}
            destructive
          />
        </ShadowBoxOnMd>
      </div>
      <PublishSummary
        article={{
          ...article,
          paid_subscribers_only: paidSubscribersOnly,
          published_at: publishAt ? publishAt.toISOString() : undefined,
          notify_subscribers: sendEmail,
          slug,
        }}
        isPublished={
          article.published_at
            ? new Date(article.published_at) <= new Date()
            : false
        }
      />
    </>
  )
}
