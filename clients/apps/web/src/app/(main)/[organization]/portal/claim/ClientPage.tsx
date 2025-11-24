'use client'

import { useSeatClaimFulfillment } from '@/hooks/useSeatClaimFulfillment'
import { CONFIG } from '@/utils/config'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import ErrorOutlined from '@mui/icons-material/ErrorOutlined'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
export default function ClientPage({
  organization,
  invitationToken,
}: {
  organization: schemas['CustomerOrganization']
  invitationToken?: string
}) {
  const router = useRouter()

  const [claimingState, setClaimingState] = useState<
    'idle' | 'claiming' | 'redirecting'
  >('idle')
  const [claimError, setClaimError] = useState<string | null>(null)

  const {
    data: claimInfo,
    isLoading,
    error: fetchError,
  } = useQuery({
    queryKey: ['seat-claim-info', invitationToken],
    queryFn: async () => {
      if (!invitationToken) {
        throw new Error('No invitation token provided')
      }

      const response = await fetch(
        `${CONFIG.BASE_URL}/v1/customer-seats/claim/${invitationToken}`,
      )

      if (!response.ok) {
        throw new Error('Invalid or expired invitation token')
      }

      return await response.json()
    },
    enabled: !!invitationToken,
    retry: false,
  })

  const [fulfillmentListener, fulfillmentLabel, cleanupFulfillment] =
    useSeatClaimFulfillment({
      apiBaseUrl: CONFIG.BASE_URL,
      invitationToken: invitationToken || '',
      maxWaitingTimeMs: 15000,
    })

  const claimMutation = useMutation({
    mutationFn: async () => {
      if (!invitationToken) {
        throw new Error('No invitation token')
      }

      const response = await fetch(
        `${CONFIG.BASE_URL}/v1/customer-seats/claim`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            invitation_token: invitationToken,
          }),
        },
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to claim seat')
      }

      return await response.json()
    },
  })

  // Establish SSE connection early to prevent race conditions
  const sseReadyRef = useRef(false)
  const fulfillmentPromiseRef = useRef<Promise<void> | null>(null)

  useEffect(() => {
    if (!claimInfo?.product_id || !invitationToken) return

    const promise = fulfillmentListener(claimInfo.product_id)
    fulfillmentPromiseRef.current = promise

    const timeout = setTimeout(() => {
      sseReadyRef.current = true
    }, 500)

    return () => {
      clearTimeout(timeout)
      cleanupFulfillment()
    }
  }, [
    claimInfo?.product_id,
    invitationToken,
    fulfillmentListener,
    cleanupFulfillment,
  ])

  const handleClaim = useCallback(async () => {
    if (!claimInfo?.product_id) return

    try {
      setClaimError(null)

      setClaimingState('claiming')

      if (!sseReadyRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 500))
        sseReadyRef.current = true
      }

      const result = await claimMutation.mutateAsync()

      await fulfillmentPromiseRef.current

      setClaimingState('redirecting')
      await new Promise((resolve) => setTimeout(resolve, 600))

      const portalUrl = `/${organization.slug}/portal?customer_session_token=${result.customer_session_token}`
      router.push(portalUrl)
    } catch (error) {
      setClaimingState('idle')
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to claim seat'
      setClaimError(errorMessage)
    }
  }, [claimInfo?.product_id, claimMutation, organization.slug, router])

  if (!invitationToken) {
    return (
      <ShadowBox className="flex flex-col items-center gap-6 p-12">
        <ErrorOutlined fontSize="large" />
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-xl">Missing Invitation Token</h2>
          <p className="dark:text-polar-500 text-gray-500">
            This page requires a valid invitation token in the URL.
          </p>
        </div>
      </ShadowBox>
    )
  }

  if (isLoading) {
    return (
      <ShadowBox className="flex flex-col items-center gap-6 p-12">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="dark:text-polar-400 text-gray-500">
          Loading invitation details...
        </p>
      </ShadowBox>
    )
  }

  if (fetchError || !claimInfo) {
    return (
      <ShadowBox className="flex flex-col items-center gap-6 p-12">
        <ErrorOutlined fontSize="large" />
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="text-xl">Invalid Invitation</h2>
          <p className="dark:text-polar-500 text-gray-500">
            This invitation link is invalid, has expired, or has already been
            claimed. Contact the person who invited you to resend the
            invitation.
          </p>
        </div>
      </ShadowBox>
    )
  }

  if (claimingState !== 'idle') {
    const isRedirecting = claimingState === 'redirecting'

    return (
      <ShadowBox className="flex flex-col items-center gap-6 p-12">
        {isRedirecting ? (
          <>
            <CheckOutlined fontSize="large" />
            <div className="flex flex-col items-center gap-2 text-center">
              <h2 className="text-xl font-medium">Success!</h2>
              <p className="dark:text-polar-500 text-gray-500">
                Redirecting to your portal...
              </p>
            </div>
          </>
        ) : (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <div className="flex flex-col items-center gap-2 text-center">
              <h2 className="text-xl">
                {fulfillmentLabel || 'Claiming benefits...'}
              </h2>
              <p className="dark:text-polar-500 text-sm text-gray-500">
                Please wait while we set up your access
              </p>
            </div>
          </>
        )}
      </ShadowBox>
    )
  }

  return (
    <ShadowBox className="flex w-full max-w-2xl flex-col gap-8 p-8 md:p-12">
      <div className="flex flex-col gap-4">
        <h2 className="text-xl">Claim Your Seat</h2>
        <p className="dark:text-polar-500 text-gray-500">
          You&apos;ve been invited to access {claimInfo.product_name}
        </p>
      </div>

      <div className="dark:bg-polar-800 flex flex-col gap-4 rounded-2xl bg-white p-6">
        <div className="flex flex-col gap-1">
          <span className="dark:text-polar-400 text-sm text-gray-500">
            Product
          </span>
          <span>{claimInfo.product_name}</span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="dark:text-polar-400 text-sm text-gray-500">
            Organization
          </span>
          <span>{claimInfo.organization_name}</span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="dark:text-polar-400 text-sm text-gray-500">
            Your Email
          </span>
          <span>{claimInfo.customer_email}</span>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <Button
          onClick={handleClaim}
          loading={claimingState !== 'idle'}
          disabled={claimingState !== 'idle'}
          size="lg"
        >
          {claimingState !== 'idle' ? 'Claiming...' : 'Claim Seat'}
        </Button>

        {(claimError || claimMutation.error) && (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {claimError || claimMutation.error?.message}
          </div>
        )}
      </div>
    </ShadowBox>
  )
}
