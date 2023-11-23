import Link from 'next/link'

import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Backoffice',
}

export default function Page() {
  return (
    <div className="flex flex-col">
      <Link href="/backoffice/pledges">Pledges</Link>
      <Link href="/backoffice/rewards_pending">Rewards Pending</Link>
      <Link href="/backoffice/badge">Issue Badge</Link>
      <Link href="/backoffice/rebadge">Issue Re-Badge (update message)</Link>
    </div>
  )
}
