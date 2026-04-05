'use client'

import { useCustomerEmailUpdateVerify } from '@/hooks/queries/customerPortal'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
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
          <h2 className="text-2xl text-black dark:text-white">Invalid link</h2>
          <p className="dark:text-polar-500 text-center text-gray-500">
            This verification link is invalid or has expired.
          </p>
        </div>
      </ShadowBox>
    )
  }

  if (verify.isSuccess) {
    return (
      <ShadowBox className="flex w-full max-w-7xl flex-col items-center gap-12 md:px-32 md:py-24">
        <div className="flex w-full flex-col items-center gap-y-4 md:max-w-sm">
          <h2 className="text-2xl text-black dark:text-white">Email updated</h2>
          <p className="dark:text-polar-500 text-center text-gray-500">
            Your email has been updated. Redirecting you to the Customer Portal…
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
            Verify new email
          </h2>
          <p className="dark:text-polar-500 text-center text-gray-500">
            You&rsquo;re updating your email address for{' '}
            <span className="font-medium">{organization.name}</span>. Once
            confirmed, you&rsquo;ll use this new email to access your purchases.
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
          Confirm Email Change
        </Button>

        <p className="dark:text-polar-500 text-center text-sm text-gray-500">
          Changed your mind? You can safely ignore this and your current email
          will remain active.
        </p>
      </div>
    </ShadowBox>
  )
}

export default VerifyEmailPage
