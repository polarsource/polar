import { api, queryClient } from '@/utils/api'
import {
  ConfirmIssueSplit,
  CurrencyAmount,
  Issue,
  IssueListResponse,
  IssueUpdateBadgeMessage,
  ListResourceIssue,
  ListResourcePledge,
  PostIssueComment,
} from '@polar-sh/sdk'
import {
  InfiniteData,
  UseMutationResult,
  useMutation,
  useQuery,
} from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useIssue = (id: string) =>
  useQuery({
    queryKey: ['issues', id],
    queryFn: () => api.issues.get({ id }),
    retry: defaultRetry,
  })

export const useIssueAddPolarBadge: () => UseMutationResult<
  Issue,
  Error,
  {
    id: string
  },
  unknown
> = () =>
  useMutation({
    mutationFn: (variables: { id: string }) => {
      return api.issues.addPolarBadge(variables)
    },
    onSuccess: (result, _variables, _ctx) => {
      updateIssuesCache(result)
    },
  })

export const useIssueRemovePolarBadge = () =>
  useMutation({
    mutationFn: (variables: { id: string }) => {
      return api.issues.removePolarBadge(variables)
    },
    onSuccess: (result, _variables, _ctx) => {
      updateIssuesCache(result)
    },
  })

export const useIssueAddComment = () =>
  useMutation({
    mutationFn: (variables: { id: string; body: PostIssueComment }) => {
      return api.issues.addIssueComment({
        id: variables.id,
        body: variables.body,
      })
    },
  })

export const useBadgeWithComment = () =>
  useMutation({
    mutationFn: (variables: { id: string; body: IssueUpdateBadgeMessage }) => {
      return api.issues.badgeWithMessage({
        id: variables.id,
        body: variables.body,
      })
    },
  })

export const useUpdateIssue = () =>
  useMutation({
    mutationFn: (variables: {
      id: string
      funding_goal?: CurrencyAmount
      upfront_split_to_contributors?: number
      set_upfront_split_to_contributors?: boolean
    }) => {
      return api.issues.update({
        id: variables.id,
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
      updateIssuesCache(result)
    },
  })

const updateIssuesCache = (result: Issue) => {
  // update issue in dashboard results
  queryClient.setQueriesData<InfiniteData<IssueListResponse>>(
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

  queryClient.setQueriesData<ListResourcePledge>(
    {
      queryKey: ['pledgeByIssue', result.id],
    },
    (data) => {
      if (!data) {
        return data
      }

      return {
        ...data,
        items: data.items?.map((i) => {
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

  queryClient.setQueriesData<ListResourcePledge>(
    {
      queryKey: ['pledgeList'],
    },
    (data) => {
      if (!data) {
        return data
      }

      return {
        ...data,
        items: data.items?.map((i) => {
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

  queryClient.setQueriesData<ListResourceIssue>(
    {
      queryKey: ['issues'],
    },
    (data) => {
      if (!data) {
        return data
      }
      return {
        ...data,
        items: data.items?.map((i) => {
          if (i.id === result.id) {
            return result
          }
          return { ...i }
        }),
      }
    },
  )

  queryClient.setQueriesData<ListResourceIssue>(
    {
      queryKey: ['issuesForYou'],
    },
    (data) => {
      if (!data) {
        return data
      }
      return {
        ...data,
        items: data.items?.map((i) => {
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
    queryFn: () => api.issues.forYou(),
    retry: defaultRetry,
  })

export const useIssueMarkConfirmed = () =>
  useMutation({
    mutationFn: (variables: { id: string; splits: ConfirmIssueSplit[] }) => {
      return api.issues.confirm({
        id: variables.id,
        body: {
          splits: variables.splits,
        },
      })
    },
    onSuccess: async (result, _variables, _ctx) => {
      updateIssuesCache(result)
    },
  })

export const useListPullsReferencingIssue = (issueId?: string) =>
  useQuery({
    queryKey: ['pullsByIssue', issueId],
    queryFn: () =>
      api.pullRequests.search({
        referencesIssueId: issueId || '',
      }),

    enabled: !!issueId,
    retry: defaultRetry,
  })
