import { InfiniteData, useMutation } from '@tanstack/react-query'
import { api, queryClient } from '../../api'
import {
  IssueListResponse,
  Platforms,
  PostIssueComment,
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
                    return { ...issue, attributes: result }
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
                    return { ...issue, attributes: result }
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
