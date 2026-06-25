'use client'

import { useModal } from '@/components/Modal/useModal'
import { useCopyMemberLoginLink } from '@/hooks/useCopyMemberLoginLink'
import { useMembers } from '@/hooks/queries/members'
import { useMultipleCustomerSeats } from '@/hooks/queries/seats'
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined'
import { schemas } from '@polar-sh/client'
import {
  Avatar,
  Button,
  DataTable,
  InlineModal,
  Status,
  type StatusColor,
  Text,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import { useMemo, useState } from 'react'
import { EditMemberModal } from './EditMemberModal'
import { seatStatusDisplayConfig } from '../Seats/seatStatus'

const roleDisplayConfig: Record<
  'owner' | 'billing_manager' | 'member',
  [string, StatusColor]
> = {
  owner: ['Owner', 'blue'],
  billing_manager: ['Billing Manager', 'purple'],
  member: ['Member', 'gray'],
}

// Which status to surface when a member holds multiple seats (highest first).
const seatStatusPriority: schemas['SeatStatus'][] = [
  'pending',
  'claimed',
  'revoked',
]

interface MembersSectionProps {
  organization: schemas['Organization']
  customer: schemas['Customer']
  subscriptions?: schemas['Subscription'][]
  orders?: schemas['Order'][]
}

export const MembersSection = ({
  organization,
  customer,
  subscriptions,
  orders,
}: MembersSectionProps) => {
  const { data: membersData, isLoading } = useMembers(customer.id)
  const copyMemberLoginLink = useCopyMemberLoginLink(organization.slug)

  const isEnabled =
    organization?.feature_settings?.member_model_enabled &&
    organization?.feature_settings?.seat_based_pricing_enabled &&
    customer.type === 'team'

  // Filters out non-seat subscriptions and orders to minimize no. requests.
  // Could in future be replaced with an endpoint
  const seatContainers = useMemo(
    () =>
      isEnabled
        ? [
            ...(subscriptions ?? [])
              .filter((subscription) => typeof subscription.seats === 'number')
              .map((subscription) => ({ subscriptionId: subscription.id })),
            ...(orders ?? [])
              .filter((order) => typeof order.seats === 'number')
              .map((order) => ({ orderId: order.id })),
          ]
        : [],
    [isEnabled, subscriptions, orders],
  )
  const { seats } = useMultipleCustomerSeats(seatContainers)

  const [selectedMember, setSelectedMember] = useState<
    schemas['Member'] | null
  >(null)
  const {
    show: showEditMemberModal,
    hide: hideEditMemberModal,
    isShown: isEditMemberModalShown,
  } = useModal()

  const members = useMemo(
    () => membersData?.pages.flatMap((page) => page.items) ?? [],
    [membersData],
  )

  const seatsByMemberId = useMemo(() => {
    const map = new Map<string, schemas['CustomerSeat'][]>()
    seats.forEach((seat) => {
      if (!seat.member_id) {
        return
      }
      const existing = map.get(seat.member_id) ?? []
      existing.push(seat)
      map.set(seat.member_id, existing)
    })
    return map
  }, [seats])

  if (!isEnabled) {
    return null
  }

  return (
    <Box flexDirection="column" gap="l">
      <Text variant="heading-xxs" as="h3">
        Members
      </Text>
      <DataTable
        data={members}
        columns={[
          {
            header: 'Member',
            accessorKey: 'email',
            size: 260,
            cell: ({ row: { original } }) => (
              <Box alignItems="center" gap="m">
                <Avatar
                  className="h-8 w-8"
                  name={original.name ?? original.email}
                  avatar_url={null}
                />
                <Box flexDirection="column">
                  <Text>{original.name ?? original.email}</Text>
                  {original.name && <Text color="muted">{original.email}</Text>}
                </Box>
              </Box>
            ),
          },
          {
            header: 'Role',
            accessorKey: 'role',
            cell: ({ row: { original } }) => {
              const [label, color] = roleDisplayConfig[original.role]
              return <Status color={color} status={label} size="small" />
            },
          },
          {
            header: 'Seat',
            id: 'seat',
            cell: ({ row: { original } }) => {
              const memberSeats = seatsByMemberId.get(original.id) ?? []
              const status = seatStatusPriority.find((candidate) =>
                memberSeats.some((seat) => seat.status === candidate),
              )
              const config = status
                ? seatStatusDisplayConfig[status]
                : undefined
              if (!config) {
                return <Text>—</Text>
              }
              const [label, color] = config
              return (
                <Box alignItems="center" gap="s">
                  <Status color={color} status={label} size="small" />
                  {memberSeats.length > 1 && (
                    <Text variant="caption" color="muted">
                      {memberSeats.length} seats
                    </Text>
                  )}
                </Box>
              )
            },
          },
          {
            header: 'External ID',
            accessorKey: 'external_id',
            cell: ({ row: { original } }) => (
              <Text>{original.external_id ?? '—'}</Text>
            ),
          },
          {
            header: 'Created',
            accessorKey: 'created_at',
            cell: ({ row: { original } }) => (
              <FormattedDateTime datetime={original.created_at} />
            ),
          },
          {
            id: 'actions',
            header: () => null,
            size: 60,
            cell: ({ row: { original } }) => (
              <Box justifyContent="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="h-8 w-8" variant="ghost" size="icon">
                      <MoreVertOutlined fontSize="inherit" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {customer.type === 'team' && (
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedMember(original)
                          showEditMemberModal()
                        }}
                      >
                        Edit member
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => copyMemberLoginLink(original.email)}
                    >
                      Copy login link
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </Box>
            ),
          },
        ]}
        isLoading={isLoading}
        className="text-sm"
      />
      <InlineModal
        isShown={isEditMemberModalShown}
        hide={hideEditMemberModal}
        modalContent={
          selectedMember ? (
            <EditMemberModal
              member={selectedMember}
              customerId={customer.id}
              seats={seatsByMemberId.get(selectedMember.id) ?? []}
              organizationSlug={organization.slug}
              customerType={customer.type}
              onClose={hideEditMemberModal}
            />
          ) : null
        }
      />
    </Box>
  )
}
