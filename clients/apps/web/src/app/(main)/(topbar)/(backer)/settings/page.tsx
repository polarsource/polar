'use client'

import AccessTokensSettings from '@/components/Settings/AccessTokensSettings'
import AuthenticationSettings from '@/components/Settings/AuthenticationSettings'
import GeneralSettings from '@/components/Settings/GeneralSettings'
import OAuthSettings from '@/components/Settings/OAuth/OAuthSettings'
import { Section, SectionDescription } from '@/components/Settings/Section'
import { useListOrganizations } from '@/hooks/queries'

export default function Page() {
  const { data: organizations } = useListOrganizations({})
  return (
    <div className="relative z-0">
      <div className="mb-24 flex flex-col gap-y-16">
        <div className="flex flex-col gap-y-8">
          <h1 className="text-2xl">Settings</h1>
          <div className="flex flex-col gap-y-4">
            <Section>
              <SectionDescription title="General" description="" />
              <GeneralSettings />
            </Section>

            <Section>
              <SectionDescription
                title="Signin connections"
                description="Connect external accounts for authenticating to Polar."
              />
              <AuthenticationSettings />
            </Section>
          </div>
        </div>

        <div className="flex flex-col gap-y-8">
          <h2 className="text-2xl">Developer Settings</h2>

          <div className="flex flex-col gap-y-4">
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
        </div>
      </div>
    </div>
  )
}
