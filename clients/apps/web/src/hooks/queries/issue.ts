import { queryClient } from '@/utils/api/query'
import { api } from '@/utils/client'
import { components, unwrap } from '@polar-sh/client'
import { InfiniteData, useMutation, useQuery } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useIssue = (id: string) =>
  useQuery({
    queryKey: ['issues', id],
    queryFn: () =>
      unwrap(api.GET('/v1/issues/{id}', { params: { path: { id } } })),
    retry: defaultRetry,
  })

export const useIssueAddPolarBadge = () =>
  useMutation({
    mutationFn: (variables: { id: string }) => {
      return api.POST('/v1/issues/{id}/add_badge', {
        params: { path: { id: variables.id } },
      })
    },
    onSuccess: (result, _variables, _ctx) => {
      if (result.error) {
        return
      }
      updateIssuesCache(result.data)
    },
  })

export const useIssueRemovePolarBadge = () =>
  useMutation({
    mutationFn: (variables: { id: string }) => {
      return api.POST('/v1/issues/{id}/remove_badge', {
        params: { path: { id: variables.id } },
      })
    },
    onSuccess: (result, _variables, _ctx) => {
      if (result.error) {
        return
      }
      updateIssuesCache(result.data)
    },
  })

export const useIssueAddComment = () =>
  useMutation({
    mutationFn: (variables: {
      id: string
      body: components['schemas']['PostIssueComment']
    }) => {
      return api.POST('/v1/issues/{id}/comment', {
        params: { path: { id: variables.id } },
        body: variables.body,
      })
    },
  })

export const useBadgeWithComment = () =>
  useMutation({
    mutationFn: (variables: {
      id: string
      body: components['schemas']['IssueUpdateBadgeMessage']
    }) => {
      return api.POST('/v1/issues/{id}/badge_with_message', {
        params: { path: { id: variables.id } },
        body: variables.body,
      })
    },
  })

export const useUpdateIssue = () =>
  useMutation({
    mutationFn: (variables: {
      id: string
      funding_goal?: components['schemas']['CurrencyAmount']
      upfront_split_to_contributors?: number | null
      set_upfront_split_to_contributors?: boolean
    }) => {
      return api.POST('/v1/issues/{id}', {
        params: { path: { id: variables.id } },
        body: {
          funding_goal: variables.funding_goal,
          upfront_split_to_contributors:
            variables.upfront_split_to_contributors,
          set_upfront_split_to_contributors:
            variables.set_upfront_split_to_contributors,
        },
      })
    },
    onSuccess: (result, _variables, _ctx) => {
      if (result.error) {
        return
      }
      updateIssuesCache(result.data)
    },
  })

const updateIssuesCache = (result: components['schemas']['Issue']) => {
  // update issue in dashboard results
  queryClient.setQueriesData<
    InfiniteData<components['schemas']['IssueListResponse']>
  >(
    {
      queryKey: ['dashboard', 'repo'],
    },
    (data) => {
      if (!data) {
        return data
      }

      return {
        ...data,
        pages: data.pages.map((p) => {
          return {
            ...p,
            data: p.data.map((issue) => {
              if (issue.id === result.id) {
                return {
                  ...issue,
                  attributes: {
                    ...issue.attributes,
                    ...result,
                  },
                }
              }
              return { ...issue }
            }),
          }
        }),
      }
    },
  )

  queryClient.setQueriesData<components['schemas']['ListResource_Pledge_']>(
    {
      queryKey: ['pledgeByIssue', result.id],
    },
    (data) => {
      if (!data) {
        return data
      }

      return {
        ...data,
        items: data.items.map((i) => {
          if (i.issue.id === result.id) {
            return {
              ...i,
              issue: result,
            }
          }
          return { ...i }
        }),
      }
    },
  )

  queryClient.setQueriesData<components['schemas']['ListResource_Pledge_']>(
    {
      queryKey: ['pledgeList'],
    },
    (data) => {
      if (!data) {
        return data
      }

      return {
        ...data,
        items: data.items.map((i) => {
          if (i.issue.id === result.id) {
            return {
              ...i,
              issue: result,
            }
          }
          return { ...i }
        }),
      }
    },
  )

  queryClient.setQueriesData<components['schemas']['ListResource_Issue_']>(
    {
      queryKey: ['issuesForYou'],
    },
    (data) => {
      if (!data) {
        return data
      }
      return {
        ...data,
        items: data.items.map((i) => {
          if (i.id === result.id) {
            return result
          }
          return { ...i }
        }),
      }
    },
  )
}

export const useListForYouIssues = () =>
  useQuery({
    queryKey: ['issuesForYou'],
    queryFn: () => unwrap(api.GET('/v1/issues/for_you')),
    retry: defaultRetry,
  })

export const useIssueMarkConfirmed = () =>
  useMutation({
    mutationFn: (variables: {
      id: string
      splits: components['schemas']['ConfirmIssueSplit'][]
    }) => {
      return api.POST('/v1/issues/{id}/confirm_solved', {
        params: { path: { id: variables.id } },
        body: {
          splits: variables.splits,
        },
      })
    },
    onSuccess: async (result, _variables, _ctx) => {
      if (result.error) {
        return
      }
      updateIssuesCache(result.data)
    },
  })
