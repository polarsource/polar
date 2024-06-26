import { api } from '@/utils/api'
import { RepositoryUpdate } from '@polar-sh/sdk'
import { useMutation } from '@tanstack/react-query'
import { defaultRetry } from './retry'

export const useUpdateProject = () =>
  useMutation({
    mutationFn: (variables: {
      id: string
      body: RepositoryUpdate
    }) => {
      return api.repositories.update(variables)
    },
    retry: defaultRetry,
  })
