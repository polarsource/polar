import Gatekeeper from '@/components/Dashboard/Gatekeeper/Gatekeeper'
import type { NextPageWithLayout } from '@/utils/next'
import { useRouter } from 'next/router'
import { ReactElement } from 'react'

/**
 * TODO: Delete me in October, 2023
 *
 * I used to be a route, now I'm a mere redirect.
 * You can remove me ~1 month from now to clean up the codebase.
 */
const ExtensionSettingsPage: NextPageWithLayout = () => {
  const router = useRouter()

  router.push('/settings/extension')
  return <></>
}

ExtensionSettingsPage.getLayout = (page: ReactElement) => {
  return <Gatekeeper>{page}</Gatekeeper>
}

export default ExtensionSettingsPage
