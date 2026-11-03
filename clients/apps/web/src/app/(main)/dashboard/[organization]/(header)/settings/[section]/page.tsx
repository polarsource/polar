import {
  getSettingsSection,
  SettingsSectionSlug,
} from '@/components/Settings/settingsSections'
import { getServerSideAPI } from '@/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import SettingsSectionPage from './SettingsSectionPage'

export async function generateMetadata(props: {
  params: Promise<{ organization: string; section: string }>
}): Promise<Metadata> {
  const { section } = await props.params
  return {
    title: getSettingsSection(section)?.title ?? 'Settings', // " | Polar is added by the template"
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string; section: string }>
}) {
  const params = await props.params
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  if (!getSettingsSection(params.section, organization)) {
    notFound()
  }

  return (
    <SettingsSectionPage
      organization={organization}
      section={params.section as SettingsSectionSlug}
    />
  )
}
