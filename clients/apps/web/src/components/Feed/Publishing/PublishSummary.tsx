import { Article } from '@polar-sh/sdk'
import { Button, ShadowBoxOnMd } from 'polarkit/components/ui/atoms'
import { useArticleReceivers } from 'polarkit/hooks'
import { useMemo } from 'react'
import { useArticleActions } from './useArticleActions'

interface ArticleSummaryProps {
  article: Article
  isPublished: boolean
}

export const PublishSummary = ({
  article,
  isPublished,
}: ArticleSummaryProps) => {
  const { data: articleReceivers, refetch: refetchArticleReceivers } =
    useArticleReceivers(
      article.organization.name,
      article.paid_subscribers_only ?? false,
    )

  const publishedAtDate = useMemo(
    () => (article.published_at ? new Date(article.published_at) : undefined),
    [article],
  )

  const articleActions = useArticleActions(
    article.id,
    {
      ...article,
      byline: undefined,
    },
    !isPublished,
  )

  return (
    <ShadowBoxOnMd className="sticky top-0 flex w-full flex-col gap-y-8">
      <div className="flex flex-col gap-y-2">
        <h2 className="font-medium leading-relaxed">Publish</h2>
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
          <li>{articleReceivers?.free_subscribers} Free subscribers</li>
          <li>{articleReceivers?.premium_subscribers} Premium subscribers</li>
          <li>{articleReceivers?.organization_members} Organization members</li>
        </ul>
      </div>
      {article.notify_subscribers && (
        <div className="flex flex-col gap-y-2">
          <h3 className="font-medium">Email</h3>
          <p className="dark:text-polar-400 text-sm text-gray-600">
            Will send email to subscribers
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
    </ShadowBoxOnMd>
  )
}
