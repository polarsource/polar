import { useAuth } from '@/hooks'
import { useCreateIdentityVerification } from '@/hooks/queries'
import { toast } from '@/components/Toast/use-toast'
import { loadStripe } from '@stripe/stripe-js'
import { useCallback, useEffect, useRef } from 'react'

const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS = 30_000

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
  const { currentUser, reloadUser } = useAuth()
  const identityVerificationStatus = currentUser?.identity_verification_status
  const createIdentityVerification = useCreateIdentityVerification()
  const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY || '')

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollingInitialStatusRef = useRef<string | undefined | null>(null)

  useEffect(() => {
    if (
      pollingRef.current &&
      identityVerificationStatus !== pollingInitialStatusRef.current
    ) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [identityVerificationStatus])

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [])

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

    pollingInitialStatusRef.current = identityVerificationStatus
    await reloadUser()
    pollingRef.current = setInterval(async () => {
      await reloadUser()
    }, POLL_INTERVAL_MS)
    setTimeout(() => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }, POLL_TIMEOUT_MS)
  }, [
    createIdentityVerification,
    stripePromise,
    reloadUser,
    identityVerificationStatus,
  ])

  return {
    start,
    identityVerificationStatus,
  }
}
