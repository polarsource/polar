import Pledges from '@/components/Backoffice/Pledges'
import Link from 'next/link'

export default function Page() {
  return (
    <div>
      <Link href="/backoffice" className="pb-8 text-black underline">
        &lArr; Back
      </Link>
      <h2 className="text-2xl">Pledges</h2>
      <Pledges />
    </div>
  )
}
