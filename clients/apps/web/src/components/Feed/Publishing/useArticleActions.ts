import { useCurrentOrgAndRepoFromURL } from '@/hooks'
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
  isPublished: boolean,
): ArticleAction[] => {
  const [isPublishing, setIsPublishing] = useState(false)
  const { org } = useCurrentOrgAndRepoFromURL()
  const update = useUpdateArticle()
  const router = useRouter()

  const handlePublish = useCallback(
    async (publishAt?: string | undefined) => {
      const updated = await update.mutateAsync({
        id,
        articleUpdate: {
          ...articleUpdate,

          // Always set published at, even if unset.
          set_published_at: true,
          published_at: publishAt ?? new Date().toISOString(),

          visibility: ArticleVisibilityEnum.PUBLIC,
        },
      })

      router.push(
        `/maintainer/${updated.organization.name}/posts/${updated.slug}`,
      )
    },
    [articleUpdate, router, update, id],
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
        await handlePublish(articleUpdate.published_at)
        setIsPublishing(false)
      },
    }
  }, [articleUpdate, handlePublish, isPublished, isPublishing])

  const cancelAction: ArticleAction = useMemo(
    () => ({
      text: 'Cancel',
      button: { variant: 'ghost' },
      onClick: () =>
        router.replace(`/maintainer/${org?.name}/posts/${articleUpdate.slug}`),
    }),
    [router, org, articleUpdate],
  )

  return [publishAction, cancelAction]
}
