import LogoIcon from '@/components/Brand/LogoIcon'
import { CONFIG } from '@/utils/config'
import { Metadata } from 'next'
import Button from 'polarkit/components/ui/atoms/button'

export const metadata: Metadata = {
  title: 'Magic link confirmation',
}

export default function Page({
  searchParams: { token, return_to },
}: {
  searchParams: { token: string; return_to?: string }
}) {
  const urlSearchParams = new URLSearchParams({
    ...(return_to && { return_to }),
  })
  return (
    <form
      className="dark:bg-polar-950 flex h-screen w-full grow items-center justify-center  bg-gray-50"
      method="post"
      action={`${CONFIG.BASE_URL}/v1/magic_link/authenticate?${urlSearchParams.toString()}`}
    >
      <div id="polar-bg-gradient"></div>
      <div className="flex w-80 flex-col items-center gap-4">
        <LogoIcon size={30} className="mb-6 text-blue-500 dark:text-blue-400" />
        <div className="dark:text-polar-400 text-center text-gray-500">
          To complete the login verification process, please click the button
          below:
        </div>
        <input type="hidden" name="token" value={token} />
        <Button fullWidth size="lg" type="submit">
          Login
        </Button>
      </div>
    </form>
  )
}
