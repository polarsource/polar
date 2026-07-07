import { TrialsPage } from '@/components/Landing/features/TrialsPage'
import { buildMetadata } from '@/utils/metadata'

export const metadata = buildMetadata({
  path: '/features/trials',
  title: 'Trials — Polar',
  description:
    'Free or paid trials with automatic conversion, conversion reminders, and abuse protection — built into your subscriptions.',
  keywords:
    'free trial, trial period, trial conversion, trial abuse prevention, saas trial',
})

export default function Page() {
  return <TrialsPage />
}
