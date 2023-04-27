import { useMutation } from '@tanstack/react-query'
import { api } from '../../api'

export const useInviteClaimCode = () =>
  useMutation({
    mutationFn: (variables: { code: string }) => {
      return api.invite.claim({ code: variables.code })
    },
  })

export const useUserAcceptTermsOfService = () =>
  useMutation({
    mutationFn: () => {
      return api.users.acceptTerms()
    },
  })
