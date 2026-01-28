'use client'

import {
  useCustomerPortalMembers,
  usePortalAuthenticatedUser,
  useRemoveCustomerPortalMember,
  useUpdateCustomerPortalMember,
} from '@/hooks/queries'
import { createClientSideAPI } from '@/utils/client'
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { DataTable } from '@polar-sh/ui/components/atoms/DataTable'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/atoms/DropdownMenu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { ConfirmModal } from '../Modal/ConfirmModal'
import { Well, WellContent, WellHeader } from '../Shared/Well'

interface CustomerPortalTeamProps {
  organization: schemas['CustomerOrganization']
  customerSessionToken?: string
}

const roleDisplayNames: Record<string, [string, string]> = {
  owner: [
    'Owner',
    'bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400',
  ],
  billing_manager: [
    'Billing Manager',
    'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
  ],
  member: [
    'Member',
    'bg-gray-100 text-gray-600 dark:bg-polar-700 dark:text-polar-400',
  ],
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export const CustomerPortalTeam = ({
  customerSessionToken,
  organization,
}: CustomerPortalTeamProps) => {
  const api = createClientSideAPI(customerSessionToken)

  const { data: members, isLoading: isLoadingMembers } =
    useCustomerPortalMembers(api)
  const { data: authenticatedUser } = usePortalAuthenticatedUser(api)
  const updateMember = useUpdateCustomerPortalMember(api)
  const removeMember = useRemoveCustomerPortalMember(api)

  const [memberToRemove, setMemberToRemove] = useState<string | null>(null)
  const [removingMembers, setRemovingMembers] = useState<Set<string>>(new Set())
  const [updatingMembers, setUpdatingMembers] = useState<Set<string>>(new Set())

  const currentMemberId =
    authenticatedUser?.type === 'member'
      ? (authenticatedUser as any).member_id
      : null

  const handleRoleChange = async (memberId: string, newRole: string) => {
    setUpdatingMembers((prev) => new Set([...prev, memberId]))
    try {
      await updateMember.mutateAsync({
        id: memberId,
        body: { role: newRole as any },
      })
    } finally {
      setUpdatingMembers((prev) => {
        const next = new Set(prev)
        next.delete(memberId)
        return next
      })
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    setRemovingMembers((prev) => new Set([...prev, memberId]))
    try {
      await removeMember.mutateAsync(memberId)
    } finally {
      setRemovingMembers((prev) => {
        const next = new Set(prev)
        next.delete(memberId)
        return next
      })
      setMemberToRemove(null)
    }
  }

  const membersList = members ?? []
  const memberToRemoveData = membersList.find((m) => m.id === memberToRemove)

  return (
    <div className="flex flex-col gap-y-8">
      <h3 className="text-2xl">Team Members</h3>

      <Well className="dark:bg-polar-900 flex flex-col gap-y-6 bg-gray-50">
        <WellHeader className="flex-row items-start justify-between">
          <div className="flex flex-col gap-y-2">
            <h3 className="text-xl">Members</h3>
            <p className="dark:text-polar-500 text-gray-500">
              Manage team members and their roles
            </p>
          </div>
        </WellHeader>
        <WellContent>
          <DataTable
            data={membersList}
            isLoading={isLoadingMembers}
            columns={[
              {
                accessorKey: 'name',
                header: 'Name',
                cell: ({ row }) => (
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {row.original.name || '—'}
                    </span>
                    <span className="dark:text-polar-500 text-xs text-gray-500">
                      {row.original.email}
                    </span>
                  </div>
                ),
              },
              {
                accessorKey: 'role',
                header: 'Role',
                cell: ({ row }) => {
                  const member = row.original
                  const isCurrentUser = member.id === currentMemberId
                  const isUpdating = updatingMembers.has(member.id)

                  // Current user can't change their own role
                  if (isCurrentUser) {
                    const [label, className] =
                      roleDisplayNames[member.role] || roleDisplayNames.member
                    return (
                      <div className="flex items-center gap-2">
                        <Status
                          className={twMerge(className, 'w-fit text-xs')}
                          status={label}
                        />
                        <span className="dark:text-polar-500 text-xs text-gray-500">
                          (you)
                        </span>
                      </div>
                    )
                  }

                  return (
                    <Select
                      value={member.role}
                      onValueChange={(value) =>
                        handleRoleChange(member.id, value)
                      }
                      disabled={isUpdating}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Owner</SelectItem>
                        <SelectItem value="billing_manager">
                          Billing Manager
                        </SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                      </SelectContent>
                    </Select>
                  )
                },
              },
              {
                accessorKey: 'created_at',
                header: 'Joined',
                cell: ({ row }) => (
                  <span className="dark:text-polar-500 text-sm text-gray-500">
                    {formatDate(row.original.created_at)}
                  </span>
                ),
              },
              {
                id: 'actions',
                header: '',
                cell: ({ row }) => {
                  const member = row.original
                  const isCurrentUser = member.id === currentMemberId
                  const isLoading =
                    removingMembers.has(member.id) ||
                    updatingMembers.has(member.id)

                  // Current user can't remove themselves
                  if (isCurrentUser) {
                    return null
                  }

                  return (
                    <div className="flex justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild disabled={isLoading}>
                          <Button className="h-8 w-8" variant="secondary">
                            <MoreVertOutlined fontSize="inherit" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              handleRoleChange(member.id, 'billing_manager')
                            }
                            disabled={
                              isLoading || member.role === 'billing_manager'
                            }
                          >
                            Make Billing Manager
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleRoleChange(member.id, 'owner')}
                            disabled={isLoading || member.role === 'owner'}
                          >
                            Make Owner
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setMemberToRemove(member.id)}
                            disabled={isLoading}
                            className="text-red-500 focus:text-red-500"
                          >
                            Remove from Team
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )
                },
              },
            ]}
          />
        </WellContent>
      </Well>

      <ConfirmModal
        isShown={memberToRemove !== null}
        hide={() => setMemberToRemove(null)}
        title="Remove Team Member"
        description={`Are you sure you want to remove ${memberToRemoveData?.name || memberToRemoveData?.email || 'this member'} from the team? They will lose access to all team resources.`}
        onConfirm={() => memberToRemove && handleRemoveMember(memberToRemove)}
        destructive
        destructiveText="Remove"
      />
    </div>
  )
}
