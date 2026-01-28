'use client'

import {
  useAddCustomerPortalMember,
  useCustomerPortalMembers,
  usePortalAuthenticatedUser,
  useRemoveCustomerPortalMember,
  useUpdateCustomerPortalMember,
} from '@/hooks/queries'
import { createClientSideAPI } from '@/utils/client'
import { validateEmail } from '@/utils/validation'
import GroupOutlined from '@mui/icons-material/GroupOutlined'
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined'
import Button from '@polar-sh/ui/components/atoms/Button'
import { DataTable } from '@polar-sh/ui/components/atoms/DataTable'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/atoms/DropdownMenu'
import Input from '@polar-sh/ui/components/atoms/Input'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { ConfirmModal } from '../Modal/ConfirmModal'
import { toast } from '../Toast/use-toast'
import { EmptyState } from './EmptyState'

interface CustomerPortalTeamProps {
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

const availableRoles = [
  { value: 'owner', label: 'Make Owner' },
  { value: 'billing_manager', label: 'Make Billing Manager' },
  { value: 'member', label: 'Make Member' },
] as const

const roleToDisplayName = (role: string): string => {
  const display = roleDisplayNames[role]
  return display ? display[0] : role
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
}: CustomerPortalTeamProps) => {
  const api = createClientSideAPI(customerSessionToken)

  const { data: members, isLoading: isLoadingMembers } =
    useCustomerPortalMembers(api)
  const { data: authenticatedUser } = usePortalAuthenticatedUser(api)
  const updateMember = useUpdateCustomerPortalMember(api)
  const removeMember = useRemoveCustomerPortalMember(api)
  const addMember = useAddCustomerPortalMember(api)

  const [memberToRemove, setMemberToRemove] = useState<string | null>(null)
  const [loadingMembers, setLoadingMembers] = useState<Set<string>>(new Set())

  // Add member form state
  const [newMemberEmail, setNewMemberEmail] = useState('')
  const [addMemberError, setAddMemberError] = useState<string | undefined>()
  const [isAddingMember, setIsAddingMember] = useState(false)

  const currentMemberId =
    authenticatedUser?.type === 'member'
      ? (authenticatedUser as any).member_id
      : null

  const handleAddMember = async () => {
    if (!newMemberEmail.trim()) {
      setAddMemberError('Email is required')
      return
    }
    if (!validateEmail(newMemberEmail)) {
      setAddMemberError('Invalid email format')
      return
    }

    setIsAddingMember(true)
    setAddMemberError(undefined)

    try {
      await addMember.mutateAsync({
        email: newMemberEmail,
        role: 'member',
      })
      toast({
        title: 'Member added',
        description: `${newMemberEmail} has been added to the team.`,
      })
      setNewMemberEmail('')
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to add member'
      setAddMemberError(errorMessage)
      toast({
        title: 'Failed to add member',
        description: errorMessage,
        variant: 'error',
      })
    } finally {
      setIsAddingMember(false)
    }
  }

  const handleRoleChange = async (
    memberId: string,
    memberName: string | null,
    newRole: string,
  ) => {
    setLoadingMembers((prev) => new Set([...prev, memberId]))
    try {
      await updateMember.mutateAsync({
        id: memberId,
        body: { role: newRole as any },
      })
      toast({
        title: 'Role updated',
        description: `${memberName || 'Member'} is now a ${roleToDisplayName(newRole)}.`,
      })
    } catch (error) {
      toast({
        title: 'Failed to update role',
        description:
          error instanceof Error ? error.message : 'An error occurred.',
        variant: 'error',
      })
    } finally {
      setLoadingMembers((prev) => {
        const next = new Set(prev)
        next.delete(memberId)
        return next
      })
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    const memberData = membersList.find((m) => m.id === memberId)
    setLoadingMembers((prev) => new Set([...prev, memberId]))
    try {
      await removeMember.mutateAsync(memberId)
      toast({
        title: 'Member removed',
        description: `${memberData?.name || memberData?.email || 'Member'} has been removed from the team.`,
      })
    } catch (error) {
      toast({
        title: 'Failed to remove member',
        description:
          error instanceof Error ? error.message : 'An error occurred.',
        variant: 'error',
      })
    } finally {
      setLoadingMembers((prev) => {
        const next = new Set(prev)
        next.delete(memberId)
        return next
      })
      setMemberToRemove(null)
    }
  }

  const membersList = members ?? []
  const memberToRemoveData = membersList.find((m) => m.id === memberToRemove)
  const otherMembers = membersList.filter((m) => m.id !== currentMemberId)

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h3 className="text-lg">Team Members</h3>
        <p className="dark:text-polar-500 text-sm text-gray-500">
          Manage your team members and their roles
        </p>
      </div>

      <div className="flex flex-col gap-y-4">
        <div className="flex flex-col gap-y-2">
          <h4 className="text-md font-medium">Add Member</h4>
          <p className="dark:text-polar-500 text-sm text-gray-500">
            Invite someone to join your team
          </p>
        </div>
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <Input
              type="email"
              placeholder="email@example.com"
              value={newMemberEmail}
              onChange={(e) => {
                setNewMemberEmail(e.target.value)
                setAddMemberError(undefined)
              }}
              disabled={isAddingMember}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddMember()
                }
              }}
            />
            {addMemberError && (
              <p className="mt-1 text-xs text-red-500">{addMemberError}</p>
            )}
          </div>
          <Button
            onClick={handleAddMember}
            disabled={!newMemberEmail.trim() || isAddingMember}
            loading={isAddingMember}
          >
            Add
          </Button>
        </div>
      </div>

      {!isLoadingMembers && otherMembers.length === 0 ? (
        <EmptyState
          icon={<GroupOutlined fontSize="inherit" />}
          title="No Team Members"
          description="You are the only member of this team."
        />
      ) : (
        <DataTable
          data={membersList}
          isLoading={isLoadingMembers}
          columns={[
            {
              accessorKey: 'name',
              header: 'Member',
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
                const [label, className] =
                  roleDisplayNames[member.role] || roleDisplayNames.member

                return (
                  <div className="flex items-center gap-2">
                    <Status
                      className={twMerge(className, 'w-fit text-xs')}
                      status={label}
                    />
                    {isCurrentUser && (
                      <span className="dark:text-polar-500 text-xs text-gray-500">
                        (you)
                      </span>
                    )}
                  </div>
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
                const isLoading = loadingMembers.has(member.id)

                // Current user can't modify themselves
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
                        {availableRoles
                          .filter((role) => role.value !== member.role)
                          .map((role) => (
                            <DropdownMenuItem
                              key={role.value}
                              onClick={() =>
                                handleRoleChange(
                                  member.id,
                                  member.name,
                                  role.value,
                                )
                              }
                              disabled={isLoading}
                            >
                              {role.label}
                            </DropdownMenuItem>
                          ))}
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
      )}

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
