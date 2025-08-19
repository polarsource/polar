'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { DataTable } from '@polar-sh/ui/components/atoms/DataTable'
import { models } from '../../../../../../../components/Gateway/models'

export default function OverviewPage() {
  return (
    <DashboardBody className="flex flex-col gap-y-12">
      <DataTable
        columns={[
          {
            header: 'Model',
            accessorKey: 'model',
          },
          {
            header: 'Provider',
            accessorKey: 'providers',
          },
          {
            header: 'Context Size',
            accessorKey: 'contextSize',
          },
          {
            header: 'Input Price',
            accessorKey: 'inputPrice',
          },
          {
            header: 'Output Price',
            accessorKey: 'outputPrice',
          },
        ]}
        data={models}
        isLoading={false}
      />
    </DashboardBody>
  )
}
