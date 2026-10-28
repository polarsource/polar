import { DeveloperSettings } from '@/app/(main)/dashboard/[organization]/(header)/settings/[section]/PersonalSettingsSections'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'OAuth Apps',
  description: 'Manage your OAuth apps',
}

export default function Page() {
  return <DeveloperSettings />
}
