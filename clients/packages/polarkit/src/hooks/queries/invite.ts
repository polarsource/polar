import { useMutation } from '@tanstack/react-query'
import { api } from '../../api'

export const useInviteClaimCode = () =>
  useMutation({
    mutationFn: (variables: { code: string }) => {
      return api.invite.claim({ code: variables.code })
    },
  })
