import {
  InfiniteData,
  UseMutationResult,
  UseQueryResult,
  useMutation,
  useQuery,
} from '@tanstack/react-query'
import { api, queryClient } from '../../api'
import {
  ConfirmIssueSplit,
  CurrencyAmount,
  Issue,
  IssueListResponse,
  IssueSortBy,
  IssueUpdateBadgeMessage,
  Platforms,
  PostIssueComment,
  State,
} from '../../api/client'
import { defaultRetry } from './retry'

export const useIssueAddPolarBadge: () => UseMutationResult<
  Issue,
  Error,
  {
    platform: Platforms
    orgName: string
    repoName: string
    issueNumber: number
  },
  unknown
> = () =>
  useMutation({
    mutationFn: (variables: {
      platform: Platforms
      orgName: string
      repoName: string
      issueNumber: number
    }) => {
      return api.issues.addPolarBadge(variables)
    },
    onSuccess: (result, variables, ctx) => {
      // TODO: it would be cool to have an optimistic update here! :-)

      // update issue in dashboard results
      queryClient.setQueriesData<InfiniteData<IssueListResponse>>(
        ['dashboard', 'repo'],
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

                        // Map Issue (Public API) to IssueDashboardRead
                        organization_id: result.repository.organization.id,
                        repository_id: result.repository.id,
                        state:
                          result.state === Issue.state.OPEN
                            ? State.OPEN
                            : State.CLOSED,
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
    },
  })

export const useIssueRemovePolarBadge = () =>
  useMutation({
    mutationFn: (variables: {
      platform: Platforms
      orgName: string
      repoName: string
      issueNumber: number
    }) => {
      return api.issues.removePolarBadge(variables)
    },
    onSuccess: (result, variables, ctx) => {
      // update issue in dashboard results
      queryClient.setQueriesData<InfiniteData<IssueListResponse>>(
        ['dashboard', 'repo'],
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

                        // Map Issue (Public API) to IssueDashboardRead
                        organization_id: result.repository.organization.id,
                        repository_id: result.repository.id,
                        state:
                          result.state === Issue.state.OPEN
                            ? State.OPEN
                            : State.CLOSED,
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
    },
  })

export const useIssueAddComment = () =>
  useMutation({
    mutationFn: (variables: {
      platform: Platforms
      orgName: string
      repoName: string
      issueNumber: number
      body: PostIssueComment
    }) => {
      return api.issues.addIssueComment({
        platform: variables.platform,
        orgName: variables.orgName,
        repoName: variables.repoName,
        issueNumber: variables.issueNumber,
        requestBody: variables.body,
      })
    },
  })

export const useBadgeWithComment = () =>
  useMutation({
    mutationFn: (variables: {
      platform: Platforms
      orgName: string
      repoName: string
      issueNumber: number
      body: IssueUpdateBadgeMessage
    }) => {
      return api.issues.badgeWithMessage({
        platform: variables.platform,
        orgName: variables.orgName,
        repoName: variables.repoName,
        issueNumber: variables.issueNumber,
        requestBody: variables.body,
      })
    },
  })

export const useUpdateIssue = () =>
  useMutation({
    mutationFn: (variables: { id: string; funding_goal?: CurrencyAmount }) => {
      return api.issues.update({
        id: variables.id,
        requestBody: {
          funding_goal: variables.funding_goal,
        },
      })
    },
    onSuccess: (result, variables, ctx) => {
      // update issue in dashboard results
      queryClient.setQueriesData<InfiniteData<IssueListResponse>>(
        ['dashboard', 'repo'],
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

                        // Map Issue (Public API) to IssueDashboardRead
                        organization_id: result.repository.organization.id,
                        repository_id: result.repository.id,
                        state:
                          result.state === Issue.state.OPEN
                            ? State.OPEN
                            : State.CLOSED,
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
    },
  })

export const useSearchIssues: (v: {
  organizationName?: string
  repositoryName?: string
  sort?: IssueSortBy
  havePledge?: boolean
  haveBadge?: boolean
}) => UseQueryResult<unknown, Error> = (v: {
  organizationName?: string
  repositoryName?: string
  sort?: IssueSortBy
  havePledge?: boolean
  haveBadge?: boolean
}) =>
  useQuery({
    queryKey: [
      'issues',
      v.organizationName,
      v.repositoryName,
      JSON.stringify({
        sort: v.sort,
        havePledge: v.havePledge,
        haveBadge: v.haveBadge,
      }),
    ],
    queryFn: () =>
      api.issues.search({
        platform: Platforms.GITHUB,
        organizationName: v.organizationName || '',
        repositoryName: v.repositoryName,
        sort: v.sort,
        havePledge: v.havePledge,
        haveBadge: v.haveBadge,
      }),
    retry: defaultRetry,
    enabled: !!v.organizationName,
  })

export const useIssueMarkConfirmed = () =>
  useMutation({
    mutationFn: (variables: { id: string; splits: ConfirmIssueSplit[] }) => {
      return api.issues.confirm({
        id: variables.id,
        requestBody: {
          splits: variables.splits,
        },
      })
    },
    onSuccess: async (result, variables, ctx) => {
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      await queryClient.invalidateQueries({ queryKey: ['pledge'] })
      await queryClient.invalidateQueries({ queryKey: ['listPersonalPledges'] })
    },
  })
