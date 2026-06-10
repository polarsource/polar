'use client'

import { useTranslations } from '@/components/CustomerPortal/PortalLocaleProvider'
import { useSeatClaimFulfillment } from '@/hooks/useSeatClaimFulfillment'
import { CONFIG } from '@/utils/config'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import ErrorOutlined from '@mui/icons-material/ErrorOutlined'
import { schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
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
  const t = useTranslations()

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
        throw new Error(error.detail || t('portal.auth.claim.claimError'))
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
        error instanceof Error
          ? error.message
          : t('portal.auth.claim.claimError')
      setClaimError(errorMessage)
    }
  }, [claimInfo?.product_id, claimMutation, organization.slug, router, t])

  if (!invitationToken) {
    return (
      <div className="flex flex-col items-center">
        <ShadowBox className="flex w-full max-w-2xl flex-col items-center gap-6 p-12">
          <ErrorOutlined fontSize="large" />
          <div className="flex flex-col items-center gap-2 text-center">
            <h2 className="text-xl">
              {t('portal.auth.claim.missingToken.title')}
            </h2>
            <p className="dark:text-polar-500 text-gray-500">
              {t('portal.auth.claim.missingToken.description')}
            </p>
          </div>
        </ShadowBox>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center">
        <ShadowBox className="flex w-full max-w-2xl flex-col items-center gap-6 p-12">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="dark:text-polar-400 text-gray-500">
            {t('portal.auth.claim.loading')}
          </p>
        </ShadowBox>
      </div>
    )
  }

  if (fetchError || !claimInfo) {
    return (
      <div className="flex flex-col items-center">
        <ShadowBox className="flex w-full max-w-2xl flex-col items-center gap-6 p-12">
          <ErrorOutlined fontSize="large" />
          <div className="flex flex-col items-center gap-4 text-center">
            <h2 className="text-xl">
              {t('portal.auth.claim.invalid.title')}
            </h2>
            <p className="dark:text-polar-500 text-gray-500">
              {t('portal.auth.claim.invalid.description')}
            </p>
          </div>
        </ShadowBox>
      </div>
    )
  }

  if (claimingState !== 'idle') {
    const isRedirecting = claimingState === 'redirecting'

    return (
      <div className="flex flex-col items-center">
        <ShadowBox className="flex w-full max-w-2xl flex-col items-center gap-6 p-12">
          {isRedirecting ? (
            <>
              <CheckOutlined fontSize="large" />
              <div className="flex flex-col items-center gap-2 text-center">
                <h2 className="text-xl font-medium">
                  {t('portal.auth.claim.success.title')}
                </h2>
                <p className="dark:text-polar-500 text-gray-500">
                  {t('portal.auth.claim.success.description')}
                </p>
              </div>
            </>
          ) : (
            <>
              <Loader2 className="h-8 w-8 animate-spin" />
              <div className="flex flex-col items-center gap-2 text-center">
                <h2 className="text-xl">
                  {fulfillmentLabel || t('portal.auth.claim.claiming.title')}
                </h2>
                <p className="dark:text-polar-500 text-sm text-gray-500">
                  {t('portal.auth.claim.claiming.description')}
                </p>
              </div>
            </>
          )}
        </ShadowBox>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center">
      <ShadowBox className="flex w-full max-w-2xl flex-col gap-8 p-8 md:p-12">
        <div className="flex flex-col gap-4">
          <h2 className="text-xl">{t('portal.auth.claim.title')}</h2>
          <p className="dark:text-polar-500 text-gray-500">
            {t('portal.auth.claim.description', {
              productName: claimInfo.product_name,
              organizationName: claimInfo.organization_name,
            })}
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <Button
            onClick={handleClaim}
            loading={claimingState !== 'idle'}
            disabled={claimingState !== 'idle'}
            size="lg"
          >
            {claimingState !== 'idle'
              ? t('portal.auth.claim.claimingButton')
              : t('portal.auth.claim.claimButton')}
          </Button>

          {(claimError || claimMutation.error) && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {claimError || claimMutation.error?.message}
            </div>
          )}
        </div>
      </ShadowBox>
    </div>
  )
}
