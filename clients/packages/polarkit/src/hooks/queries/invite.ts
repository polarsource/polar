import { UseMutationResult, useMutation } from '@tanstack/react-query'
import { api } from '../../api'
import { UserRead } from '../../api/client'

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
