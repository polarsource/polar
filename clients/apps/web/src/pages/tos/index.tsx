import type { NextLayoutComponentType } from 'next'
import { ReactElement } from 'react'
import Topbar from '../../components/Shared/Topbar'

const Page: NextLayoutComponentType = () => {
  return (
    <div className="flex flex-col">
      <h1 className="text-2xl font-bold">Privacy Policy</h1>
    </div>
  )
}

Page.getLayout = (page: ReactElement) => {
  return (
    <>
      <Topbar></Topbar>
      <div className="mx-auto max-w-7xl p-4">{page}</div>
    </>
  )
}

export default Page
