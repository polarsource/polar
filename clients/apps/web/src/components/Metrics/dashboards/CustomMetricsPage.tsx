import { schemas } from '@polar-sh/client'
import CustomMetricsClientPage from './CustomMetricsClientPage'

interface CustomMetricsPageProps {
  organization: schemas['Organization']
}

export default function CustomMetricsPage({
  organization,
}: CustomMetricsPageProps) {
  return <CustomMetricsClientPage organization={organization} />
}
