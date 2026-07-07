import { StartupProgramPage } from '@/components/Landing/startup-program/StartupProgramPage'
import { buildMetadata } from '@/utils/metadata'

export const metadata = buildMetadata({
  path: '/startup-program',
  title: 'Polar Startup Program',
  description:
    'Scale-tier pricing for a full year, free. For AI and SaaS startups building on Polar.',
})

export default function Page() {
  return <StartupProgramPage />
}
