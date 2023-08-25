import { useMutation } from '@tanstack/react-query'
import { api } from '../../api'

export const useUserAcceptTermsOfService = () =>
  useMutation({
    mutationFn: () => {
      return api.users.acceptTerms()
    },
  })
