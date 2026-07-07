import { FinancePage } from '@/components/Landing/features/FinancePage'
import { buildMetadata } from '@/utils/metadata'

export const metadata = buildMetadata({
  path: '/features/finance',
  title: 'Finance — Polar',
  description:
    'Live balance, transactions ledger, transparent fees, and manual payouts. All visible.',
  keywords:
    'finance, payouts, transactions, ledger, balance, fees, stripe connect, multi-currency',
})

export default function Page() {
  return <FinancePage />
}
