import Invites from '@/components/Backoffice/Invites'
import Link from 'next/link'

export default function Page() {
  return (
    <div>
      <Link href="/backoffice" className="pb-8 text-black underline">
        &lArr; Back
      </Link>
      <h2 className="text-2xl">Invites</h2>
      <Invites />
    </div>
  )
}
