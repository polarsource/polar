'use client'

import {
  useAddCustomerPortalMember,
  useCustomerPortalMembers,
  usePortalAuthenticatedUser,
  useRemoveCustomerPortalMember,
  useUpdateCustomerPortalMember,
} from '@/hooks/queries'
import { validateEmail } from '@/utils/validation'
import GroupOutlined from '@mui/icons-material/GroupOutlined'
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined'
import { Client } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/atoms/DropdownMenu'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import { useState } from 'react'
import { ConfirmModal } from '../Modal/ConfirmModal'
import { toast } from '../Toast/use-toast'
import { EmptyState } from './EmptyState'

interface CustomerPortalTeamSectionProps {
  api: Client
}

const roleDisplayNames: Record<string, string> = {
  owner: 'Owner',
  billing_manager: 'Billing Manager',
  member: 'Member',
}

const availableRoles = [
  { value: 'owner', label: 'Owner' },
  { value: 'billing_manager', label: 'Billing Manager' },
  { value: 'member', label: 'Member' },
] as const

const roleToDisplayName = (role: string): string => {
  return roleDisplayNames[role] || role
}

export const CustomerPortalTeamSection = ({
  api,
}: CustomerPortalTeamSectionProps) => {
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
    authenticatedUser?.type === 'member' ? authenticatedUser.member_id : null

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
        role: 'billing_manager',
      })
      toast({
        title: 'Billing manager added',
        description: `${newMemberEmail} has been added as a billing manager.`,
      })
      setNewMemberEmail('')
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to add billing manager'
      setAddMemberError(errorMessage)
      toast({
        title: 'Failed to add billing manager',
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

  const membersList = members?.items ?? []
  const memberToRemoveData = membersList.find((m) => m.id === memberToRemove)
  const otherMembers = membersList.filter((m) => m.id !== currentMemberId)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-y-4">
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
            Invite
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
        <div className="dark:border-polar-700 overflow-hidden rounded-2xl border border-gray-200">
          <table className="w-full table-fixed caption-bottom text-sm">
            <thead className="[&_tr]:border-b">
              <tr className="dark:bg-polar-800 border-b bg-gray-50 transition-colors">
                <th className="text-muted-foreground h-12 px-4 text-left align-middle font-medium">
                  Member
                </th>
                <th className="text-muted-foreground h-12 w-[180px] px-4 text-left align-middle font-medium">
                  Role
                </th>
                <th className="text-muted-foreground h-12 w-[60px] px-4 text-left align-middle font-medium" />
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {membersList.map((member) => {
                const isCurrentUser = member.id === currentMemberId
                const isLoading = loadingMembers.has(member.id)

                return (
                  <tr key={member.id} className="border-b transition-colors">
                    <td className="p-4 align-middle">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {member.name || member.email}
                          </span>
                          {isCurrentUser && (
                            <span className="dark:text-polar-500 text-xs text-gray-500">
                              (you)
                            </span>
                          )}
                        </div>
                        {member.name && (
                          <span className="dark:text-polar-500 text-xs text-gray-500">
                            {member.email}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 align-middle">
                      <Select
                        value={member.role}
                        onValueChange={(newRole) =>
                          handleRoleChange(member.id, member.name, newRole)
                        }
                        disabled={isCurrentUser || isLoading}
                      >
                        <SelectTrigger className="w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableRoles.map((role) => (
                            <SelectItem key={role.value} value={role.value}>
                              {role.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-4 align-middle">
                      {!isCurrentUser && (
                        <div className="flex justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild disabled={isLoading}>
                              <Button
                                className="h-8 w-8"
                                variant="ghost"
                                size="icon"
                              >
                                <MoreVertOutlined fontSize="inherit" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
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
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
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
