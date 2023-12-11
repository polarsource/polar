'use client'

import { PublishSettings } from '@/components/Feed/Publishing/PublishSettings'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import DashboardTopbar from '@/components/Shared/DashboardTopbar'
import Spinner from '@/components/Shared/Spinner'
import { Article } from '@polar-sh/sdk'

interface ClientPageProps {
  article: Article
}

const ClientPage = ({ article }: ClientPageProps) => {
  if (!article) {
    return (
      <DashboardBody>
        <Spinner />
      </DashboardBody>
    )
  }

  return (
    <>
      <DashboardTopbar title="Publish" isFixed useOrgFromURL />
      <DashboardBody className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <PublishSettings article={article} />
      </DashboardBody>
    </>
  )
}

export default ClientPage
