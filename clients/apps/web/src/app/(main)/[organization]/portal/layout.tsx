import PublicLayout from '@/components/Layout/PublicLayout'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationOrNotFound } from '@/utils/customerPortal'

export default async function Layout({
  params,
  children,
}: {
  params: { organization: string }
  children: React.ReactNode
}) {
  const api = getServerSideAPI()
  await getOrganizationOrNotFound(api, params.organization)

  return <PublicLayout footer={false}>{children}</PublicLayout>
}
