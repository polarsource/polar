import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { notFound } from 'next/navigation'
import { PropsWithChildren } from 'react'

export default async function Layout(
  props: PropsWithChildren<{
    params: Promise<{ organization: string }>
  }>,
) {
  const params = await props.params
  const organization = await getOrganizationBySlugOrNotFound(
    params.organization,
  )
  if (!organization.feature_settings?.config_as_code_enabled) {
    notFound()
  }

  return props.children
}
