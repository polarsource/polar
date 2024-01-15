import { useModal } from '@/components/Modal/useModal'
import { Article, ArticleVisibilityEnum } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { Button, ShadowBoxOnMd } from 'polarkit/components/ui/atoms'
import { useArticleReceivers } from 'polarkit/hooks'
import { useCallback, useMemo } from 'react'
import { PublishShareModal } from './PublishShareModal'
import { useArticleActions } from './useArticleActions'

interface ArticleSummaryProps {
  article: Article
}

export const PublishSummary = ({ article }: ArticleSummaryProps) => {
  const { isShown: isModalShown, hide: hideModal, show: showModal } = useModal()
  const router = useRouter()

  const onHideModal = useCallback(() => {
    hideModal()

    router.push(`/${article.organization.name}/posts/${article.slug}`)
  }, [article, router, hideModal])

  const { data: articleReceivers, refetch: refetchArticleReceivers } =
    useArticleReceivers(
      article.organization.name,
      article.paid_subscribers_only ?? false,
    )

  const publishedAtDate = useMemo(
    () => (article.published_at ? new Date(article.published_at) : undefined),
    [article],
  )

  const isPublished = Boolean(
    article.published_at &&
      new Date(article.published_at) <= new Date() &&
      article.visibility === ArticleVisibilityEnum.PUBLIC,
  )

  const articleActions = useArticleActions(
    article.id,
    {
      ...article,
      byline: undefined,
    },
    isPublished,
    showModal,
  )

  const plural = (count: number) => {
    if (count == 1) {
      return ''
    }
    return 's'
  }

  return (
    <ShadowBoxOnMd className="sticky top-0 flex w-full flex-col gap-y-8">
      <div className="flex flex-col gap-y-2">
        <h2 className="font-medium leading-relaxed">
          {isPublished ? 'Published' : 'Publish'}
        </h2>
        {publishedAtDate ? (
          <div className="flex flex-col gap-y-2">
            <div className="flex flex-col text-sm">
              <h3 className="dark:text-polar-50 font-medium text-gray-950">
                Your Timezone
              </h3>
              <p className="dark:text-polar-400 text-gray-600">
                {publishedAtDate.toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}{' '}
                at{' '}
                {publishedAtDate.toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZoneName: 'short',
                })}
              </p>
            </div>
            <div className="flex flex-col text-sm">
              <h3 className="dark:text-polar-50 font-medium text-gray-950">
                UTC
              </h3>
              <p className="dark:text-polar-400 text-gray-600">
                {publishedAtDate.toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  timeZone: 'UTC',
                })}{' '}
                at{' '}
                {publishedAtDate.toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZoneName: 'short',
                  timeZone: 'UTC',
                })}
              </p>
            </div>
          </div>
        ) : (
          <span className="dark:text-polar-400 text-sm text-gray-600">Now</span>
        )}
      </div>
      <div className="flex flex-col gap-y-2">
        <h3 className="font-medium">Audience</h3>
        <ul className="dark:text-polar-400 text-sm text-gray-600">
          {articleReceivers?.free_subscribers !== undefined ? (
            <li>
              {articleReceivers.free_subscribers} free subscriber
              {plural(articleReceivers.free_subscribers)}
            </li>
          ) : null}

          {articleReceivers?.premium_subscribers !== undefined ? (
            <li>
              {articleReceivers.premium_subscribers} premium subscriber
              {plural(articleReceivers.premium_subscribers)}
            </li>
          ) : null}

          {!article.paid_subscribers_only ? (
            <li>Anyone on the web</li>
          ) : (
            <li>Premium subscribers on the web</li>
          )}
        </ul>
      </div>

      {article.notify_subscribers && !article.notifications_sent_at && (
        <div className="flex flex-col gap-y-2">
          <h3 className="font-medium">Email</h3>
          <p className="dark:text-polar-400 text-sm text-gray-600">
            Will send email to{' '}
            {article.paid_subscribers_only
              ? 'all premium subscribers'
              : 'all subscribers'}
            .
          </p>
        </div>
      )}
      <div className="flex flex-col gap-y-2">
        {articleActions.map((action) => (
          <Button key={action.text} {...action.button} onClick={action.onClick}>
            {action.text}
          </Button>
        ))}
      </div>
      <PublishShareModal
        isShown={isModalShown}
        hide={onHideModal}
        article={article}
      />
    </ShadowBoxOnMd>
  )
}
