'use client'

import { useMembers } from '@/hooks/queries/members'
import { useOrganization } from '@/hooks/queries/org'
import { DataTable } from '@polar-sh/ui/components/atoms/DataTable'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

const roleDisplayConfig = {
  owner: [
    'Owner',
    'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
  ],
  billing_manager: [
    'Billing Manager',
    'bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400',
  ],
  member: [
    'Member',
    'bg-gray-100 text-gray-600 dark:bg-polar-700 dark:text-polar-400',
  ],
} as const

interface MembersSectionProps {
  customerId: string
  organizationId: string
}

export const MembersSection = ({
  customerId,
  organizationId,
}: MembersSectionProps) => {
  const { data: organization } = useOrganization(organizationId, !!organizationId)
  const { data: membersData, isLoading } = useMembers(customerId)

  const isEnabled =
    organization?.feature_settings?.member_model_enabled &&
    organization?.feature_settings?.seat_based_pricing_enabled

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
              const [label, className] = roleDisplayConfig[original.role]
              return (
                <Status
                  className={twMerge(className, 'w-fit text-xs')}
                  status={label}
                />
              )
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
      />
    </div>
  )
}
