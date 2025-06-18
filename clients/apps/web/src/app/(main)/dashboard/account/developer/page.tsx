import OAuthSettings from '@/components/Settings/OAuth/OAuthSettings'
import { Section, SectionDescription } from '@/components/Settings/Section'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Developer',
  description: 'Manage your developer settings',
}

export default function Page() {
  return (
    <>
      <Section id="oauth">
        <SectionDescription
          title="OAuth Applications"
          description="Your configured OAuth Applications"
        />

        <OAuthSettings />
      </Section>
    </>
  )
}
