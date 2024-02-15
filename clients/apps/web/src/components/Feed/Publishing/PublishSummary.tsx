import { Article, ArticleUpdate, ArticleVisibilityEnum } from '@polar-sh/sdk'
import { Button, ShadowBoxOnMd } from 'polarkit/components/ui/atoms'
import { useArticleReceivers } from 'polarkit/hooks'
import { useFormContext } from 'react-hook-form'

interface ArticleSummaryProps {
  article: Article
  isSaving: boolean
}

export const isPublished = (article: Article): boolean => {
  return Boolean(
    article.published_at &&
      new Date(article.published_at) <= new Date() &&
      article.visibility === ArticleVisibilityEnum.PUBLIC,
  )
}

export const isScheduled = (article: Article): boolean => {
  return Boolean(
    article.published_at &&
      new Date(article.published_at) > new Date() &&
      article.visibility === ArticleVisibilityEnum.PUBLIC,
  )
}

export const PublishSummary = ({ article, isSaving }: ArticleSummaryProps) => {
  const { watch } = useFormContext<ArticleUpdate>()

  const formValues = watch()

  const { data: articleReceivers } = useArticleReceivers(
    article.organization.name,
    formValues.paid_subscribers_only ?? false,
  )

  const publishedAtDate = formValues.published_at
    ? new Date(formValues.published_at)
    : undefined

  const isAlreadyPublished = isPublished(article)

  const isAlreadyScheduled = isScheduled(article)

  const plural = (count: number) => {
    if (count == 1) {
      return ''
    }
    return 's'
  }

  const willNotifySubscribers =
    formValues.notify_subscribers && !article.notifications_sent_at

  const publishVerb = () => {
    // Already published
    if (isAlreadyPublished) {
      return 'Save'
    }

    if (publishedAtDate && new Date(publishedAtDate) > new Date()) {
      if (isAlreadyScheduled) {
        return 'Update schedule'
      }

      return 'Schedule'
    }

    return 'Publish now'
  }

  return (
    <ShadowBoxOnMd className="sticky top-0 flex h-fit w-full flex-col gap-y-8">
      <div className="flex flex-col gap-y-2">
        <h2 className="font-medium leading-relaxed">
          {isAlreadyPublished ? 'Published' : 'Publish'}
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

      {willNotifySubscribers ? (
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
      ) : null}

      <div className="flex flex-col gap-y-2">
        <Button
          type="submit"
          loading={isSaving}
          variant={'default'}
          fullWidth
          // onClick={() => alert('hey')}
        >
          {publishVerb()}
        </Button>
      </div>
    </ShadowBoxOnMd>
  )
}
