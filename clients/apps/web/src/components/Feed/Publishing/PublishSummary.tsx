import { Article } from '@polar-sh/sdk'
import {
  Button,
  PolarTimeAgo,
  ShadowBoxOnMd,
} from 'polarkit/components/ui/atoms'
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
    <ShadowBoxOnMd className="flex w-full flex-col gap-y-8">
      <div className="flex flex-col gap-y-2">
        <h2 className="text-lg font-medium leading-relaxed">{article.title}</h2>
        {publishedAtDate ? (
          <div className="flex flex-col gap-y-4">
            <span className="text-sm font-medium">
              {publishedAtDate < new Date() ? 'Published' : 'Publishing'}{' '}
              <PolarTimeAgo date={publishedAtDate} />
            </span>
            <div className="flex flex-col text-sm">
              <h3 className="font-medium">Your timezone</h3>
              <p className="dark:text-polar-500 text-gray-500">
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
              <h3 className="font-medium">UTC</h3>
              <p className="dark:text-polar-500 text-gray-500">
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
          <span className="dark:text-polar-500 text-sm text-gray-500">
            Publish Now
          </span>
        )}
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
        {articleActions.map((action) => (
          <Button key={action.text} {...action.button} onClick={action.onClick}>
            {action.text}
          </Button>
        ))}
      </div>
    </ShadowBoxOnMd>
  )
}
