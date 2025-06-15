'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import AccessTokensSettings from '@/components/Settings/AccessTokensSettings'
import OAuthSettings from '@/components/Settings/OAuth/OAuthSettings'
import { Section, SectionDescription } from '@/components/Settings/Section'
import { useListOrganizations } from '@/hooks/queries'

export default function Page() {
  const { data: organizations } = useListOrganizations({})

  return (
    <DashboardBody wrapperClassName="md:gap-y-12">
      <div className="flex flex-col gap-y-16">
        {organizations && organizations.items.length > 0 && (
          <Section id="pat">
            <SectionDescription
              title="Personal Access Tokens"
              description="Manage access tokens which can be used to authenticate you with the Polar API."
            />
            <AccessTokensSettings />
          </Section>
        )}

        <Section id="oauth">
          <SectionDescription
            title="OAuth Applications"
            description="Your configured OAuth Applications."
          />

          <OAuthSettings />
        </Section>
      </div>
    </DashboardBody>
  )
}
