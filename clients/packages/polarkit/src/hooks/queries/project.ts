import { RepositoryUpdate } from '@polar-sh/sdk'
import { useMutation } from '@tanstack/react-query'
import { api } from '../../api'
import { defaultRetry } from './retry'

export const useUpdateProject = () =>
  useMutation({
    mutationFn: (variables: {
      id: string
      repositoryUpdate: RepositoryUpdate
    }) => {
      return api.repositories.update(variables)
    },
    retry: defaultRetry,
  })
