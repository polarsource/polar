'use client'

import { BenefitActivityLog } from '@/components/Benefit/BenefitActivityLog/BenefitActivityLog'
import { Organization } from '@polar-sh/sdk'

interface BenefitActivityPageProps {
  organization: Organization
}

export default function ClientPage({ organization }: BenefitActivityPageProps) {
  return (
    <div className="flex flex-col gap-y-8">
      <BenefitActivityLog />
    </div>
  )
}
