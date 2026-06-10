'use client'

import { useTranslations } from '@/components/CustomerPortal/PortalLocaleProvider'
import { useCustomerEmailUpdateVerify } from '@/hooks/queries/customerPortal'
import { schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

const VerifyEmailPage = ({
  organization,
  token,
  tokenValid,
}: {
  organization: schemas['CustomerOrganization']
  token?: string
  tokenValid: boolean
}) => {
  const router = useRouter()
  const t = useTranslations()
  const verify = useCustomerEmailUpdateVerify()

  const onConfirm = useCallback(async () => {
    if (!token) return
    const sessionToken = (await verify.mutateAsync({ token }))?.token
    if (!sessionToken) return
    router.push(
      `/${organization.slug}/portal/settings?customer_session_token=${sessionToken}`,
    )
  }, [token, verify, router, organization.slug])

  if (!token || !tokenValid) {
    return (
      <ShadowBox className="flex w-full max-w-7xl flex-col items-center gap-12 md:px-32 md:py-24">
        <div className="flex w-full flex-col items-center gap-y-4 md:max-w-sm">
          <h2 className="text-2xl text-black dark:text-white">
            {t('portal.auth.verifyEmail.invalidLink.title')}
          </h2>
          <p className="dark:text-polar-500 text-center text-gray-500">
            {t('portal.auth.verifyEmail.invalidLink.description')}
          </p>
        </div>
      </ShadowBox>
    )
  }

  if (verify.isSuccess) {
    return (
      <ShadowBox className="flex w-full max-w-7xl flex-col items-center gap-12 md:px-32 md:py-24">
        <div className="flex w-full flex-col items-center gap-y-4 md:max-w-sm">
          <h2 className="text-2xl text-black dark:text-white">
            {t('portal.auth.verifyEmail.updated.title')}
          </h2>
          <p className="dark:text-polar-500 text-center text-gray-500">
            {t('portal.auth.verifyEmail.updated.description')}
          </p>
        </div>
      </ShadowBox>
    )
  }

  return (
    <ShadowBox className="flex w-full max-w-7xl flex-col items-center gap-12 md:px-32 md:py-24">
      <div className="flex w-full flex-col items-center gap-y-6 md:max-w-sm">
        <div className="flex flex-col items-center gap-4">
          <h2 className="text-2xl text-black dark:text-white">
            {t('portal.auth.verifyEmail.verify.title')}
          </h2>
          <p className="dark:text-polar-500 text-center text-gray-500">
            {t('portal.auth.verifyEmail.verify.descriptionPrefix')}{' '}
            <span className="font-medium">{organization.name}</span>
            {t('portal.auth.verifyEmail.verify.descriptionSuffix')}
          </p>
        </div>

        {verify.error && (
          <p className="text-sm font-medium text-red-500 dark:text-red-400">
            {verify.error.message}
          </p>
        )}

        <Button
          size="lg"
          className="w-full"
          onClick={onConfirm}
          loading={verify.isPending}
          disabled={verify.isPending}
        >
          {t('portal.auth.verifyEmail.verify.confirmButton')}
        </Button>

        <p className="dark:text-polar-500 text-center text-sm text-gray-500">
          {t('portal.auth.verifyEmail.verify.changedMind')}
        </p>
      </div>
    </ShadowBox>
  )
}

export default VerifyEmailPage
