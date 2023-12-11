import { ArticleUpdate, ArticleVisibilityEnum } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
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
  isDraft: boolean,
): ArticleAction[] => {
  const [isPublishing, setIsPublishing] = useState(false)
  const update = useUpdateArticle()
  const router = useRouter()

  const handlePublish = useCallback(
    async (publishAt?: string | undefined) => {
      const updated = await update.mutateAsync({
        id,
        articleUpdate: {
          ...articleUpdate,
          set_published_at: publishAt ? true : false,
          published_at: publishAt,
          visibility: ArticleVisibilityEnum.PUBLIC,
        },
      })

      if (publishAt) {
        router.push(`/${updated.organization.name}/posts/${updated.slug}`)
      } else {
        router.push(`/maintainer/${updated.organization.name}/posts`)
      }
    },
    [articleUpdate, router, update, id],
  )

  const publishAction: ArticleAction = useMemo(() => {
    const publishVerb = () => {
      // Already published
      if (!isDraft) {
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
        await handlePublish(articleUpdate.published_at)
        setIsPublishing(false)
      },
    }
  }, [articleUpdate, handlePublish, isDraft, isPublishing])

  return [publishAction]
}
