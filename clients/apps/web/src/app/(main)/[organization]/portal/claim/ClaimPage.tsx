'use client'

import { useSeatClaimFulfillment } from '@/hooks/useSeatClaimFulfillment'
import { CONFIG } from '@/utils/config'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import ErrorOutlined from '@mui/icons-material/ErrorOutlined'
import { schemas } from '@polar-sh/client'
import { Alert, Button } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { PortalText } from '@/components/CustomerPortal/PortalPrimitives'
import { PortalAuthHeader, PortalAuthShell } from '../PortalShell'
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

  const content = (() => {
    if (!invitationToken) {
      return (
        <ClaimStatus
          icon={<ErrorOutlined fontSize="inherit" />}
          title="Missing invitation token"
          description="This page requires a valid invitation token in the URL."
        />
      )
    }

    if (isLoading) {
      return (
        <ClaimStatus
          icon={<Loader2 className="h-6 w-6 animate-spin" />}
          title="Loading invitation"
          description="Fetching your invitation details…"
        />
      )
    }

    if (fetchError || !claimInfo) {
      return (
        <ClaimStatus
          icon={<ErrorOutlined fontSize="inherit" />}
          title="Invalid invitation"
          description="This invitation link is invalid, has expired, or has already been claimed. Contact the person who invited you to resend the invitation."
        />
      )
    }

    if (claimingState !== 'idle') {
      return claimingState === 'redirecting' ? (
        <ClaimStatus
          icon={<CheckOutlined fontSize="inherit" />}
          title="Seat claimed"
          description="Redirecting to your portal…"
        />
      ) : (
        <ClaimStatus
          icon={<Loader2 className="h-6 w-6 animate-spin" />}
          title={fulfillmentLabel || 'Claiming benefits…'}
          description="Please wait while we set up your access."
        />
      )
    }

    return (
      <Box flexDirection="column" rowGap="xl">
        <PortalAuthHeader
          title="Claim your seat"
          description={`You've been invited to ${claimInfo.product_name} on ${claimInfo.organization_name}.`}
        />
        <Button onClick={handleClaim} size="lg" fullWidth>
          Claim seat
        </Button>
        {(claimError || claimMutation.error) && (
          <Alert
            variant="danger"
            title={claimError || claimMutation.error?.message || ''}
          />
        )}
      </Box>
    )
  })()

  return (
    <PortalAuthShell organization={organization}>{content}</PortalAuthShell>
  )
}

const ClaimStatus = ({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) => (
  <Box flexDirection="column" rowGap="l">
    <PortalText tone="secondary" className="text-2xl">
      {icon}
    </PortalText>
    <PortalAuthHeader title={title} description={description} />
  </Box>
)
