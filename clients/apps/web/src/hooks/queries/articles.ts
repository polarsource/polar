import revalidate from '@/app/actions'
import { api, queryClient } from '@/utils/api'
import {
  Article,
  ArticleCreate,
  ArticleUpdate,
  ArticlesApiListRequest,
  ListResourceArticle,
} from '@polar-sh/sdk'
import {
  InfiniteData,
  UseInfiniteQueryResult,
  UseMutationResult,
  useInfiniteQuery,
  useMutation,
  useQuery,
} from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useListArticles = (
  parameters?: Omit<ArticlesApiListRequest, 'page'>,
): UseInfiniteQueryResult<InfiniteData<ListResourceArticle>> =>
  useInfiniteQuery({
    queryKey: ['articles', 'list', { ...parameters }],
    queryFn: ({ signal, pageParam = 1 }) => {
      const promise = api.articles.list({ page: pageParam, ...parameters })

      signal?.addEventListener('abort', () => {
        // TODO!
        // promise.cancel()
      })

      return promise
    },
    getNextPageParam: (
      lastPage: ListResourceArticle,
      pages,
    ): number | undefined => {
      return lastPage.pagination.max_page > pages.length
        ? pages.length + 1
        : undefined
    },
    initialPageParam: 1,
    retry: defaultRetry,
  })

export const useCreateArticle = (): UseMutationResult<
  Article,
  Error,
  ArticleCreate,
  unknown
> =>
  useMutation({
    mutationFn: (articleCreate: ArticleCreate) =>
      api.articles.create({
        body: {
          ...articleCreate,

          // Base64 encoded body over the wire. To "bypass" WAF.
          body: undefined,
          body_base64: articleCreate.body
            ? Buffer.from(articleCreate.body).toString('base64')
            : undefined,
        },
      }),
    onSuccess: (result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: [
          'articles',
          'list',
          { organizationId: result.organization_id },
        ],
      })
      revalidate(`articles:${result.organization_id}`)
    },
  })

export const useUpdateArticle = () =>
  useMutation({
    mutationFn: (variables: { id: string; articleUpdate: ArticleUpdate }) =>
      api.articles.update({
        id: variables.id,
        body: {
          ...variables.articleUpdate,

          // Base64 encoded body over the wire. To "bypass" WAF.
          body: undefined,
          body_base64: variables.articleUpdate.body
            ? Buffer.from(variables.articleUpdate.body).toString('base64')
            : undefined,
        },
      }),
    onSuccess: (result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: [
          'articles',
          'list',
          { organizationId: result.organization_id },
        ],
      })
      queryClient.invalidateQueries({
        queryKey: ['articles', 'id', result.id],
      })
      queryClient.invalidateQueries({
        queryKey: ['articles', 'receivers', result.id],
      })
      revalidate(`articles:${result.organization_id}`)
      revalidate(`articles:${result.organization_id}:${result.slug}`)
    },
  })

export const useDeleteArticle = () =>
  useMutation({
    mutationFn: (variables: { id: string }) =>
      api.articles.delete({
        id: variables.id,
      }),
    onSuccess: (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['articles', 'list'],
      })
      queryClient.invalidateQueries({
        queryKey: ['articles', 'id', _variables.id],
      })
    },
  })

export const useArticle = (id: string) =>
  useQuery({
    queryKey: ['articles', 'id', id],
    queryFn: () => api.articles.get({ id }),
    retry: defaultRetry,
  })

export const useArticleBySlug = (
  organizationId: string | undefined,
  slug: string,
) =>
  useQuery({
    queryKey: ['articles', { organizationId, slug }],
    queryFn: () =>
      api.articles
        .list({ organizationId, slug, limit: 1 })
        .then((r) => r.items[0]),
    retry: defaultRetry,
    enabled: !!organizationId,
  })

export const useArticleReceivers = (id: string) =>
  useQuery({
    queryKey: ['articles', 'receivers', id],
    queryFn: () =>
      api.articles.receivers({
        id,
      }),
    retry: defaultRetry,
  })

export const useSendArticlePreview = () =>
  useMutation({
    mutationFn: ({ id, email }: { id: string; email: string }) =>
      api.articles.preview({
        id,
        body: {
          email,
        },
      }),
  })
