import RewardsPending from '@/components/Backoffice/RewardsPending'
import Link from 'next/link'

export default function Page() {
  return (
    <div>
      <Link href="/backoffice" className="pb-8 text-black underline">
        &lArr; Back
      </Link>
      <h2 className="text-2xl">Rewards Pending</h2>
      <RewardsPending />
    </div>
  )
}
