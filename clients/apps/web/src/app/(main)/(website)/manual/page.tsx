import FieldGuideReader from '@/components/FieldGuide/Reader'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Billing for the Intelligence Era: The Manual',
  alternates: {
    canonical: 'https://polar.sh/manual',
  },
  description:
    'The manual for billing when every number is derived from events: events, meters, credits, invoices, entitlements and agents, drawn in code.',
}

export default function Page() {
  return <FieldGuideReader />
}
