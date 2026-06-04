'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { Modal } from '@/components/Modal'
import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useModal } from '@/components/Modal/useModal'
import { useToast } from '@/components/Toast/use-toast'
import { useAuth } from '@/hooks/auth'
import { useHasPermission } from '@/hooks/permissions'
import {
  useLeaveOrganization,
  useListOrganizationMembers,
  useRemoveOrganizationMember,
} from '@/hooks/queries/org'
import Add from '@mui/icons-material/Add'
import MoreVert from '@mui/icons-material/MoreVert'
import { schemas } from '@polar-sh/client'
import { Avatar } from '@polar-sh/orbit'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from '@polar-sh/ui/components/atoms/DataTable'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'

import { ChangeRoleModal } from './ChangeRoleModal'
import { InviteMemberModal } from './InviteMemberModal'
import { ROLE_LABELS } from './constants'

export default function ClientPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const router = useRouter()
  const { currentUser } = useAuth()
  const { toast } = useToast()
  const { data: members, isLoading } = useListOrganizationMembers(
    organization.id,
  )
  const canManageMembers = useHasPermission(organization.id, 'members:manage')
  const {
    show: openInviteMemberModal,
    hide: hideInviteMemberModal,
    isShown: isInviteMemberModalShown,
  } = useModal()

  const [memberToRemove, setMemberToRemove] = useState<
    schemas['OrganizationMember'] | null
  >(null)
  const {
    show: showRemoveModal,
    hide: hideRemoveModal,
    isShown: isRemoveModalShown,
  } = useModal()

  const {
    show: showLeaveModal,
    hide: hideLeaveModal,
    isShown: isLeaveModalShown,
  } = useModal()

  const [memberToChangeRole, setMemberToChangeRole] = useState<
    schemas['OrganizationMember'] | null
  >(null)
  const {
    show: showChangeRoleModal,
    hide: hideChangeRoleModal,
    isShown: isChangeRoleModalShown,
  } = useModal()

  const removeMember = useRemoveOrganizationMember(organization.id)
  const leaveOrganization = useLeaveOrganization(organization.id)

  const handleRemoveMember = useCallback(
    (member: schemas['OrganizationMember']) => {
      setMemberToRemove(member)
      showRemoveModal()
    },
    [showRemoveModal],
  )

  const handleChangeRole = useCallback(
    (member: schemas['OrganizationMember']) => {
      setMemberToChangeRole(member)
      showChangeRoleModal()
    },
    [showChangeRoleModal],
  )

  const onConfirmRemove = useCallback(async () => {
    if (!memberToRemove) return

    try {
      await removeMember.mutateAsync(memberToRemove.user_id)
      toast({
        title: 'Member removed',
        description: `${memberToRemove.email} has been removed from the organization.`,
      })
    } catch {
      toast({
        title: 'Failed to remove member',
        description: 'Please try again.',
      })
    }
  }, [memberToRemove, removeMember, toast])

  const onConfirmLeave = useCallback(async () => {
    try {
      await leaveOrganization.mutateAsync()
      toast({
        title: 'Left organization',
        description: `You have left ${organization.name}.`,
      })
      router.push('/dashboard')
    } catch {
      toast({
        title: 'Failed to leave organization',
        description: 'Please try again.',
      })
    }
  }, [leaveOrganization, organization.name, router, toast])

  const columns: DataTableColumnDef<schemas['OrganizationMember']>[] = [
    {
      id: 'member',
      accessorKey: 'email',
      enableSorting: true,
      size: 300,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="User" />
      ),
      cell: ({ row: { original: member } }) => {
        const isCurrentUser = member.user_id === currentUser?.id
        return (
          <Box display="flex" flexDirection="row" alignItems="center" gap="s">
            <Avatar avatar_url={member.avatar_url} name={member.email} />
            <Text>{member.email}</Text>
            <RowBadge>{ROLE_LABELS[member.role]}</RowBadge>
            {isCurrentUser && <RowBadge>You</RowBadge>}
          </Box>
        )
      },
    },
    {
      accessorKey: 'created_at',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Joined on" />
      ),
      cell: ({ row: { original: member } }) => {
        return <FormattedDateTime datetime={member.created_at} />
      },
    },
    {
      id: 'actions',
      header: () => null,
      cell: ({ row: { original: member } }) => {
        const isCurrentUser = member.user_id === currentUser?.id
        const isOwner = member.role === 'owner'

        if (isOwner) {
          return null
        }

        if (!canManageMembers && !isCurrentUser) {
          return null
        }

        return (
          <Box display="flex" justifyContent="end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="icon">
                  <MoreVert fontSize="small" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canManageMembers && (
                  <>
                    <DropdownMenuItem onClick={() => handleChangeRole(member)}>
                      Change role
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {isCurrentUser ? (
                  <DropdownMenuItem destructive onClick={showLeaveModal}>
                    Leave organization
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    destructive
                    onClick={() => handleRemoveMember(member)}
                  >
                    Remove from organization
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </Box>
        )
      },
    },
  ]

  return (
    <DashboardBody
      wrapperClassName="max-w-(--breakpoint-sm)!"
      className="flex flex-col gap-y-8"
      header={
        canManageMembers ? (
          <Button onClick={openInviteMemberModal} variant="default">
            <Add className="mr-2" fontSize="small" />
            <span>Invite</span>
          </Button>
        ) : undefined
      }
    >
      <p className="dark:text-polar-500 text-gray-500">
        Manage users who have access to this organization.
      </p>

      {members && (
        <DataTable
          columns={columns}
          data={members.items}
          isLoading={isLoading}
        />
      )}

      <Modal
        title="Invite Member"
        className="max-w-(--breakpoint-sm)!"
        modalContent={
          <InviteMemberModal
            organizationId={organization.id}
            onClose={hideInviteMemberModal}
          />
        }
        isShown={isInviteMemberModalShown}
        hide={hideInviteMemberModal}
      />

      <ConfirmModal
        isShown={isRemoveModalShown}
        hide={hideRemoveModal}
        onConfirm={onConfirmRemove}
        title="Remove Member"
        description={`Are you sure you want to remove ${memberToRemove?.email} from this organization?`}
        destructive
        destructiveText="Remove"
      />

      <ConfirmModal
        isShown={isLeaveModalShown}
        hide={hideLeaveModal}
        onConfirm={onConfirmLeave}
        title="Leave Organization"
        description={`Are you sure you want to leave ${organization.name}? You will lose access to this organization.`}
        destructive
        destructiveText="Leave"
      />

      {memberToChangeRole && (
        <Modal
          title="Change Role"
          className="max-w-(--breakpoint-sm)!"
          modalContent={
            <ChangeRoleModal
              organizationId={organization.id}
              member={memberToChangeRole}
              onClose={hideChangeRoleModal}
            />
          }
          isShown={isChangeRoleModalShown}
          hide={hideChangeRoleModal}
        />
      )}
    </DashboardBody>
  )
}

function RowBadge({ children }: { children: React.ReactNode }) {
  return (
    <Box
      as="span"
      paddingHorizontal="s"
      paddingVertical="xs"
      borderRadius="full"
      backgroundColor="background-pending"
    >
      <Text variant="caption" color="muted">
        {children}
      </Text>
    </Box>
  )
}
