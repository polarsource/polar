import Gatekeeper from '@/components/Dashboard/Gatekeeper/Gatekeeper'
import type { NextPageWithLayout } from '@/utils/next'
import { useRouter } from 'next/router'
import { ReactElement } from 'react'

const ExtensionSettingsPage: NextPageWithLayout = () => {
  const router = useRouter()

  router.push('/settings/extension')
  return <></>
}

ExtensionSettingsPage.getLayout = (page: ReactElement) => {
  return <Gatekeeper>{page}</Gatekeeper>
}

export default ExtensionSettingsPage
