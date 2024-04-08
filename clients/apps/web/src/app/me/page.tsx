import { getServerSideAPI } from '@/utils/api'
import { redirect } from 'next/navigation'
import { organizationPageLink } from 'polarkit/utils/nav'

export default async function Route() {
  const api = getServerSideAPI()

  const userAdminOrganizations = await api.organizations
    .list({ isAdminOnly: true }, { cache: 'no-store' })
    .catch(() => {
      // Handle unauthenticated
      return undefined
    })

  const personalOrganization = userAdminOrganizations?.items?.find(
    (org) => org.is_personal,
  )

  if (personalOrganization) {
    redirect(organizationPageLink(personalOrganization))
  } else {
    redirect('/feed')
  }
}
