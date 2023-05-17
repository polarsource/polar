import Invites from '@/components/Backoffice/Invites'
import type { NextLayoutComponentType } from 'next'
import Link from 'next/link'
import { ReactElement } from 'react'
import Topbar from '../../../components/Shared/Topbar'

const Page: NextLayoutComponentType = () => {
  return (
    <div>
      <h2 className="text-2xl">Invites</h2>
      <Invites />
    </div>
  )
}

Page.getLayout = (page: ReactElement) => {
  return (
    <>
      <Topbar customLogoTitle="Backoffice"></Topbar>
      <div className="mx-auto max-w-7xl p-4">
        <Link href="/backoffice" className="text-black underline">
          &lArr; Back
        </Link>
        {page}
      </div>
    </>
  )
}

export default Page
