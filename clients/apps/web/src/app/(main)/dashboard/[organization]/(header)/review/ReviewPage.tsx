'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import AIValidationResult from '@/components/Organization/AIValidationResult'
import { Section, SectionDescription } from '@/components/Settings/Section'
import { schemas } from '@polar-sh/client'

interface Props {
  organization: schemas['Organization']
}

/**
 * Merchant-facing Account Review case page (Slice 4).
 *
 * A dedicated route for the merchant to see where their organization
 * review stands — status, plain-language reason, and (when denied) the
 * appeal entry point. Reuses the existing AIValidationResult component,
 * which polls the customer-safe review-status endpoint and renders the
 * appeal form on denial, so this page introduces no new data path.
 */
export default function ReviewPage({ organization }: Props) {
  return (
    <DashboardBody wrapperClassName="max-w-(--breakpoint-sm)!">
      <div className="flex flex-col gap-y-12" data-testid="review-page">
        <Section>
          <SectionDescription
            title="Account Review"
            description="Your organization's compliance review status. We check submitted details against our acceptable use policy before enabling payments."
          />
          <AIValidationResult organization={organization} />
        </Section>
      </div>
    </DashboardBody>
  )
}
