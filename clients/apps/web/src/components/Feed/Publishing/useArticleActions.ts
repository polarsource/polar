import { Article, ArticleUpdate, ArticleVisibilityEnum } from '@polar-sh/sdk'
import { ButtonProps } from 'polarkit/components/ui/button'
import { useUpdateArticle } from 'polarkit/hooks'
import { useCallback, useMemo, useState } from 'react'

interface ArticleAction {
  text: string
  button?: ButtonProps
  onClick: () => void
}

export const useArticleActions = (
  id: string,
  articleUpdate: ArticleUpdate,
  isPublished: boolean,
  onPublish?: (article: Article) => void,
): ArticleAction[] => {
  const [isPublishing, setIsPublishing] = useState(false)
  const update = useUpdateArticle()

  const handlePublish = useCallback(
    async (publishAt?: string | undefined) => {
      return await update.mutateAsync({
        id,
        articleUpdate: {
          ...articleUpdate,

          // Always set published at, even if unset.
          set_published_at: true,
          published_at: publishAt ?? new Date().toISOString(),

          visibility: ArticleVisibilityEnum.PUBLIC,
        },
      })
    },
    [articleUpdate, update, id],
  )

  const publishAction: ArticleAction = useMemo(() => {
    const publishVerb = () => {
      // Already published
      if (isPublished) {
        return 'Save'
      }

      if (
        articleUpdate.published_at &&
        new Date(articleUpdate.published_at) > new Date()
      ) {
        return 'Schedule'
      }

      return 'Publish'
    }

    return {
      text: publishVerb(),
      button: {
        variant: 'default',
        fullWidth: true,
        loading: isPublishing,
      },
      onClick: async () => {
        setIsPublishing(true)
        const article = await handlePublish(articleUpdate.published_at)
        setIsPublishing(false)
        onPublish?.(article)
      },
    }
  }, [articleUpdate, handlePublish, isPublished, isPublishing, onPublish])

  return [publishAction]
}
