import { components } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import { DataTable } from '@polar-sh/ui/components/atoms/DataTable'

export const MeterEvents = ({
  events,
}: {
  events: components['schemas']['Event'][]
}) => {
  return (
    <DataTable
      columns={[
        {
          header: 'Customer',
          cell: ({ row: { original: event } }) => (
            <div className="flex flex-row items-center gap-x-2">
              <Avatar
                className="dark:bg-polar-900 text-xxs bg-white"
                name={'Emil Widlund'}
                avatar_url={null}
              />
              <span>
                {event.name ? event.customer_id : event.external_customer_id}
              </span>
            </div>
          ),
        },
        {
          header: 'Event Name',
          accessorKey: 'name',
          cell: ({ row: { original: event } }) => (
            <span className="font-mono text-sm">{event.name}</span>
          ),
        },
        {
          header: 'Created At',
          accessorKey: 'timestamp',
          cell: ({ row: { original: event } }) => {
            const formattedTimestamp = new Date(
              event.timestamp,
            ).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: 'numeric',
              second: 'numeric',
            })
            return (
              <span className="font-mono text-xs capitalize">
                {formattedTimestamp}
              </span>
            )
          },
        },
        {
          header: 'Metadata',
          accessorKey: 'metadata',
          cell: ({ row: { original: event } }) => (
            <span className="overflow-hidden whitespace-nowrap font-mono text-xs">
              {JSON.stringify(event.metadata)}
            </span>
          ),
        },
      ]}
      data={events}
      isLoading={false}
    />
  )
}
