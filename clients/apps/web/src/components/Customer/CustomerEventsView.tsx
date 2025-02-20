import { useEvents } from '@/hooks/queries/events'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { TabsContent } from '@polar-sh/ui/components/atoms/Tabs'
import { Events } from '../Events/Events'

export const CustomerEventsView = ({
  customer,
}: {
  customer: schemas['Customer']
}) => {
  const {
    data: events,
    isFetching,
    fetchNextPage,
    hasNextPage,
  } = useEvents(customer.organization_id, customer.id)

  return (
    <TabsContent value="events" className="flex flex-col gap-y-12">
      <Events events={events?.pages.flatMap((page) => page.items) ?? []} />
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
