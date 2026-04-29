import LogoIcon from '@/components/Brand/logos/LogoIcon'
import LogoType from '@/components/Brand/logos/LogoType'
import { CONFIG } from '@/utils/config'
import { getAuthenticatedUser } from '@/utils/user'
import Button from '@polar-sh/ui/components/atoms/Button'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Email Update confirmation',
}

export default async function Page(props: {
  searchParams: Promise<{ token: string; return_to?: string }>
}) {
  const searchParams = await props.searchParams

  const { token, return_to } = searchParams

  const user = await getAuthenticatedUser()
  if (!user) {
    const returnTo = `/verify-email?${new URLSearchParams({ token, ...(return_to && { return_to }) })}`
    redirect(`/login?${new URLSearchParams({ return_to: returnTo })}`)
  }

  const urlSearchParams = new URLSearchParams({
    ...(return_to && { return_to }),
  })

  return (
    <form
      className="dark:bg-polar-950 flex h-screen w-full grow items-center justify-center bg-white px-4"
      method="POST"
      action={`${CONFIG.BASE_URL}/v1/email-update/verify?${urlSearchParams.toString()}`}
    >
      <ShadowBox className="flex w-full max-w-7xl flex-col items-center gap-12 md:px-32 md:py-24">
        <div className="flex w-full flex-col items-center gap-y-6 md:max-w-sm">
          <div className="flex flex-col items-center gap-4 text-center">
            <LogoType className="mb-6 h-10 text-black dark:text-white" />

            <h2 className="text-2xl text-black dark:text-white">
              Confirm your new email
            </h2>

            <p className="dark:text-polar-500 text-center text-gray-500">
              After confirming, you will no longer be able to use your old email
              to log in or receive notifications.
            </p>
          </div>

          <input type="hidden" name="token" value={token} />
          <Button size="lg" type="submit">
            Confirm new email
          </Button>
        </div>
      </ShadowBox>
    </form>
  )
}
