import { UseMutationResult, useMutation } from '@tanstack/react-query'
import { UserRead } from 'api/client'
import { api } from '../../api'

export const useUserAcceptTermsOfService: () => UseMutationResult<
  UserRead,
  Error,
  void,
  unknown
> = () =>
  useMutation({
    mutationFn: () => {
      return api.users.acceptTerms()
    },
  })
