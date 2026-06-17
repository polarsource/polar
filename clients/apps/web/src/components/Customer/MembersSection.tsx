'use client'

import { useModal } from '@/components/Modal/useModal'
import { useMembers } from '@/hooks/queries/members'
import { useOrganization } from '@/hooks/queries/org'
import { useMultipleSubscriptionSeats } from '@/hooks/queries/seats'
import { schemas } from '@polar-sh/client'
import {
  Avatar,
  DataTable,
  InlineModal,
  Status,
  type StatusColor,
  Text,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
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
  customerId: string
  organizationId: string
  customerType?: 'individual' | 'team'
  subscriptionIds?: string[]
}

export const MembersSection = ({
  customerId,
  organizationId,
  customerType,
  subscriptionIds,
}: MembersSectionProps) => {
  const { data: organization } = useOrganization(
    organizationId,
    !!organizationId,
  )
  const { data: membersData, isLoading } = useMembers(customerId)
  const { seats } = useMultipleSubscriptionSeats(subscriptionIds ?? [])

  const [selectedMember, setSelectedMember] = useState<
    schemas['Member'] | null
  >(null)
  const {
    show: showEditMemberModal,
    hide: hideEditMemberModal,
    isShown: isEditMemberModalShown,
  } = useModal()

  // Only show Members section for team customers when member model is enabled
  const isEnabled =
    organization?.feature_settings?.member_model_enabled &&
    organization?.feature_settings?.seat_based_pricing_enabled &&
    customerType === 'team'

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

  if (!isEnabled || !organization) {
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
              if (!status) {
                return <Text>—</Text>
              }
              const [label, color] = seatStatusDisplayConfig[status]
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
        ]}
        isLoading={isLoading}
        className="text-sm"
        onRowClick={({ original }) => {
          if (customerType !== 'team') {
            return
          }
          setSelectedMember(original)
          showEditMemberModal()
        }}
      />
      <InlineModal
        isShown={isEditMemberModalShown}
        hide={hideEditMemberModal}
        modalContent={
          selectedMember ? (
            <EditMemberModal
              member={selectedMember}
              customerId={customerId}
              seats={seatsByMemberId.get(selectedMember.id) ?? []}
              organizationSlug={organization.slug}
              customerType={customerType}
              onClose={hideEditMemberModal}
            />
          ) : null
        }
      />
    </Box>
  )
}
