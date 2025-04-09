import { useInfiniteEvents } from '@/hooks/queries/events'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { TabsContent } from '@polar-sh/ui/components/atoms/Tabs'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Events } from '../Events/Events'
import MeterSelect from '../Meter/MeterSelect'

export const CustomerEventsView = ({
  customer,
  organization,
}: {
  customer: schemas['Customer']
  organization: schemas['Organization']
}) => {
  const searchParams = useSearchParams()
  const meterId = searchParams.get('meter_id') || 'all'
  const router = useRouter()
  const pathname = usePathname()

  const {
    data: events,
    isFetching,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteEvents(customer.organization_id, {
    limit: 50,
    customer_id: customer.id,
    ...(meterId !== 'all' ? { meter_id: meterId } : {}),
  })

  return (
    <TabsContent value="events" className="flex flex-col gap-y-4">
      <div className="flex w-1/4">
        <MeterSelect
          organizationId={customer.organization_id}
          allOption
          value={meterId}
          onValueChange={(meterId) => {
            const params = new URLSearchParams(searchParams.toString())
            if (meterId === 'all') {
              params.delete('meter_id')
            } else {
              params.set('meter_id', meterId)
            }
            router.replace(`${pathname}?${params.toString()}`)
          }}
        />
      </div>
      <Events
        events={events?.pages.flatMap((page) => page.items) ?? []}
        organization={organization}
      />
      {hasNextPage && (
        <Button
          className="self-start"
          variant="secondary"
          onClick={() => fetchNextPage()}
          loading={isFetching}
          disabled={!hasNextPage}
        >
          Load More
        </Button>
      )}
    </TabsContent>
  )
}
