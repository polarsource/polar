import LogoIcon from '@/components/Brand/LogoIcon'
import { CONFIG } from '@/utils/config'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Email Update confirmation',
}

export default async function Page(props: {
  searchParams: Promise<{ token: string; return_to?: string }>
}) {
  const searchParams = await props.searchParams

  const { token, return_to } = searchParams

  const urlSearchParams = new URLSearchParams({
    ...(return_to && { return_to }),
  })

  return (
    <form
      className="dark:bg-polar-950 flex h-screen w-full grow items-center justify-center bg-gray-50"
      method="POST"
      action={`${CONFIG.BASE_URL}/v1/email-update/verify?${urlSearchParams.toString()}`}
    >
      <div id="polar-bg-gradient"></div>
      <div className="flex w-80 flex-col items-center gap-4">
        <LogoIcon size={60} className="mb-6 text-blue-500 dark:text-blue-400" />
        <div className="dark:text-polar-400 text-center text-gray-500">
          To complete the email update process, please click the button below:
        </div>
        <input type="hidden" name="token" value={token} />
        <Button fullWidth size="lg" type="submit">
          Update the email
        </Button>
      </div>
    </form>
  )
}
