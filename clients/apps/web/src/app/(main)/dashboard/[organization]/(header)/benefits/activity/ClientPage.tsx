import { BenefitActivityLog } from '@/components/Benefit/BenefitActivityLog'
import { Organization } from '@polar-sh/sdk'

interface BenefitActivityPageProps {
  organization: Organization
}

export default function ClientPage({ organization }: BenefitActivityPageProps) {
  return <BenefitActivityLog />
}
