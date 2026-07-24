'use client'

import {
  useAddCustomerPortalMember,
  useCustomerPortalMembers,
  usePortalAuthenticatedUser,
  useRemoveCustomerPortalMember,
  useUpdateCustomerPortalMember,
} from '@/hooks/queries/customerPortal'
import { useCopyMemberLoginLink } from '@/hooks/useCopyMemberLoginLink'
import { validateEmail } from '@/utils/validation'
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined'
import { Client, schemas } from '@polar-sh/client'
import { Button, DataTable, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/atoms/DropdownMenu'
import { Input } from '@polar-sh/orbit'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/orbit'
import { useState } from 'react'
import { ConfirmModal } from '../Modal/ConfirmModal'
import { toast } from '../Toast/use-toast'

interface CustomerPortalTeamSectionProps {
  api: Client
  organizationSlug: string
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
  organizationSlug,
}: CustomerPortalTeamSectionProps) => {
  const { data: members } = useCustomerPortalMembers(api)
  const { data: authenticatedUser } = usePortalAuthenticatedUser(api)
  const updateMember = useUpdateCustomerPortalMember(api)
  const removeMember = useRemoveCustomerPortalMember(api)
  const addMember = useAddCustomerPortalMember(api)
  const copyMemberLoginLink = useCopyMemberLoginLink(organizationSlug)

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
        body: { role: newRole as schemas['MemberRole'] },
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

  return (
    <Box flexDirection="column" rowGap="xl">
      <Box alignItems="start" columnGap="l">
        <Box flexDirection="column" rowGap="xs" flex={1}>
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
            <Text variant="caption" color="danger">
              {addMemberError}
            </Text>
          )}
        </Box>
        <Button
          onClick={handleAddMember}
          disabled={!newMemberEmail.trim() || isAddingMember}
          loading={isAddingMember}
        >
          Invite billing manager
        </Button>
      </Box>

      <DataTable
        data={membersList}
        isLoading={false}
        columns={[
          {
            accessorKey: 'name',
            header: 'Member',
            cell: ({ row }) => {
              const member = row.original
              return (
                <Box flexDirection="column">
                  <Box alignItems="center" columnGap="s">
                    <Text variant="title">{member.name || member.email}</Text>
                    {member.id === currentMemberId && (
                      <Text as="span" variant="caption" color="muted">
                        (you)
                      </Text>
                    )}
                  </Box>
                  {member.name && (
                    <Text variant="caption" color="muted">
                      {member.email}
                    </Text>
                  )}
                </Box>
              )
            },
          },
          {
            accessorKey: 'role',
            header: 'Role',
            cell: ({ row }) => {
              const member = row.original
              return (
                <Select
                  value={member.role}
                  onValueChange={(newRole) =>
                    handleRoleChange(member.id, member.name, newRole)
                  }
                  disabled={
                    member.id === currentMemberId ||
                    loadingMembers.has(member.id)
                  }
                >
                  <SelectTrigger>
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
              )
            },
          },
          {
            accessorKey: 'id',
            header: '',
            cell: ({ row }) => {
              const member = row.original
              if (member.id === currentMemberId) {
                return null
              }
              const isLoading = loadingMembers.has(member.id)
              return (
                <Box justifyContent="end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild disabled={isLoading}>
                      <Button variant="ghost" size="icon">
                        <MoreVertOutlined fontSize="inherit" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => copyMemberLoginLink(member.email)}
                        disabled={isLoading}
                      >
                        Copy login link
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setMemberToRemove(member.id)}
                        disabled={isLoading}
                      >
                        Remove from team
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </Box>
              )
            },
          },
        ]}
      />

      <ConfirmModal
        isShown={memberToRemove !== null}
        hide={() => setMemberToRemove(null)}
        title="Remove team member"
        description={`Are you sure you want to remove ${memberToRemoveData?.name || memberToRemoveData?.email || 'this member'} from the team? They will lose access to all team resources.`}
        onConfirm={() => memberToRemove && handleRemoveMember(memberToRemove)}
        destructive
        destructiveText="Remove"
      />
    </Box>
  )
}
