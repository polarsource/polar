import Link from 'next/link'
import ClientPage from './ClientPage'

export default function Page() {
  return (
    <div>
      <Link href="/backoffice" className="pb-8 text-black underline">
        &lArr; Back
      </Link>
      <h2 className="text-2xl">Badge management</h2>
      <ClientPage />
    </div>
  )
}
