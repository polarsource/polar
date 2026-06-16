'use client'

import { useModal } from '@/components/Modal/useModal'
import { useMembers } from '@/hooks/queries/members'
import { useOrganization } from '@/hooks/queries/org'
import { schemas } from '@polar-sh/client'
import { DataTable, InlineModal, type StatusColor } from '@polar-sh/orbit'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { Status } from '@polar-sh/orbit'
import { useMemo, useState } from 'react'
import { EditMemberModal } from './EditMemberModal'

const roleDisplayConfig: Record<
  'owner' | 'billing_manager' | 'member',
  [string, StatusColor]
> = {
  owner: ['Owner', 'blue'],
  billing_manager: ['Billing Manager', 'purple'],
  member: ['Member', 'gray'],
}

interface MembersSectionProps {
  customer: schemas['Customer']
  organizationId: string
}

export const MembersSection = ({
  customer,
  organizationId,
}: MembersSectionProps) => {
  const { data: organization } = useOrganization(
    organizationId,
    !!organizationId,
  )
  const { data: membersData, isLoading } = useMembers(customer.id)

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
    customer.type === 'team'

  const members = useMemo(
    () => membersData?.pages.flatMap((page) => page.items) ?? [],
    [membersData],
  )

  if (!isEnabled) {
    return null
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg">Members</h3>
      <DataTable
        data={members}
        columns={[
          {
            header: 'Email',
            accessorKey: 'email',
            cell: ({ row: { original } }) => (
              <span className="text-sm">{original.email}</span>
            ),
          },
          {
            header: 'Name',
            accessorKey: 'name',
            cell: ({ row: { original } }) => (
              <span className="text-sm">{original.name ?? '—'}</span>
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
            header: 'External ID',
            accessorKey: 'external_id',
            cell: ({ row: { original } }) => (
              <span className="dark:text-polar-500 text-sm text-gray-500">
                {original.external_id ?? '—'}
              </span>
            ),
          },
          {
            header: 'Created',
            accessorKey: 'created_at',
            cell: ({ row: { original } }) => (
              <span className="dark:text-polar-500 text-sm text-gray-500">
                <FormattedDateTime datetime={original.created_at} />
              </span>
            ),
          },
        ]}
        isLoading={isLoading}
        className="text-sm"
        onRowClick={({ original }) => {
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
              customerId={customer.id}
              isCustomer={selectedMember.email === customer.email}
              onClose={hideEditMemberModal}
            />
          ) : (
            <></>
          )
        }
      />
    </div>
  )
}
