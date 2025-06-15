'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import AuthenticationSettings from '@/components/Settings/AuthenticationSettings'
import GeneralSettings from '@/components/Settings/GeneralSettings'
import { Section, SectionDescription } from '@/components/Settings/Section'

export default function Page() {
  return (
    <DashboardBody wrapperClassName="md:gap-y-12">
      <div className="flex flex-col gap-y-16">
        <Section>
          <SectionDescription
            title="Theme"
            description="Configure the theme used in Polar."
          />
          <GeneralSettings />
        </Section>

        <Section>
          <SectionDescription
            title="Signin Connections"
            description="Connect external accounts for authenticating to Polar."
          />
          <AuthenticationSettings />
        </Section>
      </div>
    </DashboardBody>
  )
}
