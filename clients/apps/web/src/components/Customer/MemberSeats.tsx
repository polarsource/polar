import { schemas } from '@polar-sh/client'
import { Button, DataTable, Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import Link from 'next/link'
import { seatStatusDisplayConfig } from '../Seats/seatStatus'

const seatSubscriptionHref = (
  seat: schemas['CustomerSeat'],
  organizationSlug: string,
): string | null =>
  seat.subscription_id
    ? `/dashboard/${organizationSlug}/sales/subscriptions/${seat.subscription_id}`
    : null

export const MemberSeats = ({
  seats,
  organizationSlug,
}: {
  seats: schemas['CustomerSeat'][]
  organizationSlug: string
}) => {
  if (seats.length === 0) {
    return <Text color="muted">No seats assigned.</Text>
  }

  return (
    <DataTable
      data={seats}
      isLoading={false}
      className="text-sm"
      columns={[
        {
          header: 'Status',
          accessorKey: 'status',
          cell: ({ row: { original } }) => {
            const [label, color] = seatStatusDisplayConfig[original.status]
            return <Status color={color} status={label} size="small" />
          },
        },
        {
          header: 'Claimed',
          accessorKey: 'claimed_at',
          cell: ({ row: { original } }) =>
            original.claimed_at ? (
              <FormattedDateTime datetime={original.claimed_at} />
            ) : (
              <Text>—</Text>
            ),
        },
        {
          header: '',
          id: 'action',
          cell: ({ row: { original } }) => {
            const href = seatSubscriptionHref(original, organizationSlug)
            if (!href) {
              return null
            }
            return (
              <Box justifyContent="end">
                <Link href={href}>
                  <Button variant="secondary" size="sm">
                    View
                  </Button>
                </Link>
              </Box>
            )
          },
        },
      ]}
    />
  )
}
