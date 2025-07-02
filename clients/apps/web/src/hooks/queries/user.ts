import { api } from '@/utils/client'
import { useMutation } from '@tanstack/react-query'

export const useCreateIdentityVerification = () =>
  useMutation({
    mutationFn: () => {
      return api.POST('/v1/users/me/identity-verification')
    },
  })
