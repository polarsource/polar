import FieldGuideReader from '@/components/FieldGuide/Reader'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Billing for the Intelligence Era: A Field Guide',
  alternates: {
    canonical: 'https://polar.sh/manual',
  },
  description:
    'A field guide to billing when every number is derived from events: events, meters, credits, invoices, entitlements and agents, drawn in code.',
}

export default function Page() {
  return <FieldGuideReader />
}
