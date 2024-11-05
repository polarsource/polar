'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import OrganizationAppearanceSettings from '@/components/Settings/OrganizationAppearanceSettings'
import { Section, SectionDescription } from '@/components/Settings/Section'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { useContext } from 'react'

export default function ClientPage() {
  const { organization: org } = useContext(MaintainerOrganizationContext)

  return (
    <DashboardBody>
      <div className="flex flex-col gap-y-12">
        <Section>
          <SectionDescription
            title="Organization"
            description="Configure your organization settings"
          />
          <OrganizationAppearanceSettings organization={org} />
        </Section>
      </div>
    </DashboardBody>
  )
}
