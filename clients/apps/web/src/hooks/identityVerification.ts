import { useAuth } from '@/hooks'
import { useCreateIdentityVerification } from '@/hooks/queries'
import { toast } from '@/components/Toast/use-toast'
import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import { AuthContext } from '@/providers/auth'
import { loadPolarStripe } from '@/utils/stripe'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useContext, useState } from 'react'

const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS = 30_000

export const isTerminalStatus = (
  status: schemas['IdentityVerificationStatus'] | null | undefined,
) => status === 'verified' || status === 'failed'

const isProcessingError = (
  detail: string | { error?: string; detail?: string } | undefined,
): boolean =>
  (typeof detail === 'object' &&
    detail?.error === 'IdentityVerificationProcessing') ||
  detail === 'Your identity verification is still processing.'

const errorMessage = (
  detail: string | { error?: string; detail?: string } | undefined,
): string => {
  if (typeof detail === 'string') return detail
  if (typeof detail === 'object' && detail?.detail) return detail.detail
  return 'Unable to start identity verification. Please try again.'
}

export const useStartIdentityVerification = () => {
  const { currentUser } = useAuth()
  const { setUser, setUserOrganizations } = useContext(AuthContext)
  const identityVerificationStatus = currentUser?.identity_verification_status
  const createIdentityVerification = useCreateIdentityVerification()
  const stripePromise = loadPolarStripe()
  const [pollingStartedAt, setPollingStartedAt] = useState<number | null>(null)

  useQuery({
    queryKey: ['users', 'me', 'identity-verification-poll', pollingStartedAt],
    queryFn: async () => {
      const user = await unwrap(api.GET('/v1/users/me'))
      setUser(user)
      setUserOrganizations(user.organizations ?? [])
      return user
    },
    enabled: pollingStartedAt !== null,
    refetchInterval: (query) =>
      pollingStartedAt === null ||
      isTerminalStatus(query.state.data?.identity_verification_status) ||
      Date.now() - pollingStartedAt >= POLL_TIMEOUT_MS
        ? false
        : POLL_INTERVAL_MS,
    retry: false,
    gcTime: 0,
  })

  const start = useCallback(async () => {
    const { data, error } = await createIdentityVerification.mutateAsync()
    if (error) {
      const detail = (error as Record<string, unknown>).detail as
        | string
        | { error?: string; detail?: string }
        | undefined
      if (isProcessingError(detail)) {
        toast({
          title: 'Identity verification in progress',
          description:
            'Your identity verification is already being processed. Please wait for it to complete.',
        })
      } else {
        toast({
          title: 'Error starting identity verification',
          description: errorMessage(detail),
        })
      }
      return
    }

    const stripe = await stripePromise
    if (!stripe) {
      toast({
        title: 'Error loading Stripe',
        description: 'Unable to load identity verification. Please try again.',
      })
      return
    }

    const { error: stripeError } = await stripe.verifyIdentity(
      data.client_secret,
    )
    if (stripeError) {
      toast({
        title: 'Identity verification error',
        description:
          stripeError.message ||
          'Something went wrong during verification. Please try again.',
      })
      return
    }

    setPollingStartedAt(Date.now())
  }, [createIdentityVerification, stripePromise])

  return {
    start,
    identityVerificationStatus,
  }
}
