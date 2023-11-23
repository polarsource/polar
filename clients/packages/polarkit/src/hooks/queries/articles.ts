import { ArticleCreate, ListResourceArticle, Platforms } from '@polar-sh/sdk'
import { UseQueryResult, useMutation, useQuery } from '@tanstack/react-query'
import { api, queryClient } from '../../api'
import { defaultRetry } from './retry'

export const useOrganizationArticles = (
  orgName: string,
  platform: Platforms = Platforms.GITHUB,
): UseQueryResult<ListResourceArticle> =>
  useQuery({
    queryKey: ['article', 'organization', orgName],
    queryFn: () =>
      api.articles.search({
        organizationName: orgName,
        platform,
      }),
    retry: defaultRetry,
  })

export const useCreateArticle = (orgName: string) =>
  useMutation({
    mutationFn: (articleCreate: ArticleCreate) =>
      api.articles.create({
        articleCreate,
      }),
    onSuccess: (result, variables, ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['article', 'organization', orgName],
      })
    },
  })

export const useArticle = (id: string) =>
  useQuery({
    queryKey: ['article', 'id', id],
    queryFn: () => api.articles.get({ id }),
    retry: defaultRetry,
    enabled: !!id,
  })
