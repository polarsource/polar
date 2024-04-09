import {
  Article,
  ArticleCreate,
  ArticleReceiversResponse,
  ArticleUpdate,
  ListResourceArticle,
  Platforms,
} from '@polar-sh/sdk'
import {
  InfiniteData,
  UseInfiniteQueryResult,
  UseMutationResult,
  UseQueryResult,
  useInfiniteQuery,
  useMutation,
  useQuery,
} from '@tanstack/react-query'
import { api, queryClient } from '../../api'
import { defaultRetry } from './retry'

export const useOrganizationArticles = (variables: {
  orgName?: string
  platform?: Platforms
  showUnpublished?: boolean
}): UseQueryResult<ListResourceArticle> =>
  useQuery({
    queryKey: [
      'article',
      'organization',
      variables.orgName,
      variables.showUnpublished,
    ],
    queryFn: () =>
      api.articles.search({
        organizationName: variables.orgName ?? '',
        platform: variables.platform ?? Platforms.GITHUB,
        showUnpublished: variables.showUnpublished,
        limit: 100,
      }),
    retry: defaultRetry,
    enabled: !!variables.orgName,
  })

export const useListArticles = (): UseInfiniteQueryResult<
  InfiniteData<ListResourceArticle>
> =>
  useInfiniteQuery({
    queryKey: ['article', 'list'],
    queryFn: ({ signal, pageParam = 1 }) => {
      const promise = api.articles.list({ page: pageParam, limit: 20 })

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

export const useSearchArticles = (
  organizationName: string,
  isPinned?: boolean,
): UseInfiniteQueryResult<InfiniteData<ListResourceArticle>> =>
  useInfiniteQuery({
    queryKey: [
      'article',
      'organization',
      organizationName,
      JSON.stringify({ isPinned }),
    ],
    queryFn: ({ signal, pageParam = 1 }) => {
      const promise = api.articles.search({
        organizationName,
        platform: Platforms.GITHUB,
        page: pageParam,
        limit: 20,
        isPinned,
      })

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
        articleCreate: {
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
        queryKey: ['article', 'organization', result.organization.name],
      })
      queryClient.invalidateQueries({
        queryKey: ['article', 'list'],
      })
    },
  })

export const useUpdateArticle = () =>
  useMutation({
    mutationFn: (variables: { id: string; articleUpdate: ArticleUpdate }) =>
      api.articles.update({
        id: variables.id,
        articleUpdate: {
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
        queryKey: ['article', 'organization', result.organization.name],
      })
      queryClient.invalidateQueries({
        queryKey: ['article', 'id', result.id],
      })
      queryClient.invalidateQueries({
        queryKey: ['article', 'lookup'],
      })
      queryClient.invalidateQueries({
        queryKey: ['article', 'list'],
      })
    },
  })

export const useDeleteArticle = () =>
  useMutation({
    mutationFn: (variables: { id: string }) =>
      api.articles._delete({
        id: variables.id,
      }),
    onSuccess: (_result, _variables, _ctx) => {
      queryClient.invalidateQueries({
        queryKey: ['article'],
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

export const useArticleLookup = (organization_name?: string, slug?: string) =>
  useQuery({
    queryKey: ['article', 'lookup', organization_name, slug],
    queryFn: () =>
      api.articles.lookup({
        platform: Platforms.GITHUB,
        organizationName: organization_name || '',
        slug: slug || '',
      }),
    retry: defaultRetry,
    enabled: !!organization_name && !!slug,
  })

export const useArticleReceivers = (
  organizationName: string,
  paidSubscribersOnly: boolean,
): UseQueryResult<ArticleReceiversResponse> =>
  useQuery({
    queryKey: ['article', 'receivers', organizationName, paidSubscribersOnly],
    queryFn: () =>
      api.articles.receivers({
        platform: Platforms.GITHUB,
        organizationName,
        paidSubscribersOnly,
      }),
    retry: defaultRetry,
  })

export const useSendArticlePreview = () =>
  useMutation({
    mutationFn: ({ id, email }: { id: string; email: string }) =>
      api.articles.sendPreview({
        id,
        articlePreview: {
          email,
        },
      }),
  })
