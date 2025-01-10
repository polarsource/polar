import { MeterEvent } from '@/app/api/meters/data'
import { PolarTimeAgo } from 'polarkit/components/ui/atoms'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import { DataTable } from 'polarkit/components/ui/atoms/datatable'

export const MeterEvents = ({ events }: { events: MeterEvent[] }) => {
  return (
    <DataTable
      columns={[
        {
          header: 'Customer',
          accessorKey: 'customer',
          cell: ({ row }) => (
            <div className="flex flex-row items-center gap-x-2">
              <Avatar
                className="dark:bg-polar-900 text-xxs bg-white"
                name={'Emil Widlund'}
                avatar_url={null}
              />
              <span>Emil Widlund</span>
            </div>
          ),
        },
        {
          header: 'Value',
          accessorKey: 'value',
          cell: ({ row }) => (
            <span className="font-mono text-sm">
              {Intl.NumberFormat('en-US', {
                notation: 'standard',
              }).format(row.original.value)}
            </span>
          ),
        },
        {
          header: 'Created At',
          accessorKey: 'created_at',
          cell: ({ row }) => (
            <span className="font-mono text-xs capitalize">
              <PolarTimeAgo date={new Date(row.original.created_at)} />
            </span>
          ),
        },
      ]}
      data={events}
      isLoading={false}
    />
  )
}
