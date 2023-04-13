import type { NextLayoutComponentType } from 'next'
import Link from 'next/link'
import { ReactElement } from 'react'
import Topbar from '../../components/Shared/Topbar'

const Page: NextLayoutComponentType = () => {
  return (
    <div className="flex flex-col">
      <h1 className="text-2xl font-bold">Pick-a-feature</h1>
      <Link href="/backoffice/pledges">Pledges</Link>
      <Link href="/backoffice/pledges_non_customers">
        Pledges to non customers
      </Link>
    </div>
  )
}

Page.getLayout = (page: ReactElement) => {
  return (
    <>
      <Topbar customLogoTitle="Backoffice"></Topbar>
      <div className="mx-auto max-w-7xl p-4">{page}</div>
    </>
  )
}

export default Page
