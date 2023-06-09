import { useMutation } from '@tanstack/react-query'
import { Platforms } from 'api/client'
import { api, queryClient } from '../../api'

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
      // TODO: override specific entry instead
      queryClient.invalidateQueries(['dashboard', 'repo', variables.orgName])
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
      // TODO: override specific entry instead
      queryClient.invalidateQueries(['dashboard', 'repo', variables.orgName])
    },
  })
