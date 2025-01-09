'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useMemo } from 'react'

const ClientPage = () => {
  const selectedBenefitContextView = useMemo(() => {
    return <div className="flex flex-col gap-y-8 p-8 py-12"></div>
  }, [])

  return (
    <DashboardBody contextView={selectedBenefitContextView}></DashboardBody>
  )
}

export default ClientPage
