import { InfiniteData, useMutation } from '@tanstack/react-query'
import { api, queryClient } from '../../api'
import {
  CurrencyAmount,
  Issue,
  IssueListResponse,
  IssueUpdateBadgeMessage,
  Platforms,
  PostIssueComment,
  State,
} from '../../api/client'

export const useIssueAddPolarBadge = () =>
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
                        organization_id:
                          result.repository?.organization?.id || '',
                        repository_id: result?.repository.id || '',
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
                        organization_id:
                          result.repository?.organization?.id || '',
                        repository_id: result?.repository.id || '',
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
                        organization_id:
                          result.repository?.organization?.id || '',
                        repository_id: result?.repository.id || '',
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
