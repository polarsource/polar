'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { Modal } from '@/components/Modal'
import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useModal } from '@/components/Modal/useModal'
import { useToast } from '@/components/Toast/use-toast'
import { useAuth } from '@/hooks/auth'
import {
  useInviteOrganizationMember,
  useLeaveOrganization,
  useListOrganizationMembers,
  useRemoveOrganizationMember,
} from '@/hooks/queries/org'
import Add from '@mui/icons-material/Add'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from '@polar-sh/ui/components/atoms/DataTable'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import Input from '@polar-sh/ui/components/atoms/Input'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'

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
  const {
    show: openInviteMemberModal,
    hide: hideInviteMemberModal,
    isShown: isInviteMemberModalShown,
  } = useModal()

  // Remove member modal state
  const [memberToRemove, setMemberToRemove] = useState<
    schemas['OrganizationMember'] | null
  >(null)
  const {
    show: showRemoveModal,
    hide: hideRemoveModal,
    isShown: isRemoveModalShown,
  } = useModal()

  // Leave organization modal state
  const {
    show: showLeaveModal,
    hide: hideLeaveModal,
    isShown: isLeaveModalShown,
  } = useModal()

  const removeMember = useRemoveOrganizationMember(organization.id)
  const leaveOrganization = useLeaveOrganization(organization.id)

  // Find the admin user from members list
  const adminMember = useMemo(
    () => members?.items.find((m) => m.is_admin),
    [members],
  )
  const isCurrentUserAdmin = adminMember?.user_id === currentUser?.id

  const handleRemoveMember = useCallback(
    (member: schemas['OrganizationMember']) => {
      setMemberToRemove(member)
      showRemoveModal()
    },
    [showRemoveModal],
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
          <div className="flex flex-row items-center gap-2">
            <Avatar avatar_url={member.avatar_url} name={member.email} />
            <div className="fw-medium">{member.email}</div>
            {member.is_admin && (
              <span className="dark:bg-polar-700 dark:text-polar-300 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                Admin
              </span>
            )}
            {isCurrentUser && (
              <span className="dark:bg-polar-700 dark:text-polar-300 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                You
              </span>
            )}
          </div>
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
        const isMemberAdmin = member.is_admin

        // Admin cannot remove themselves
        if (isCurrentUserAdmin && isMemberAdmin) {
          return null
        }

        // Admin can remove other members
        if (isCurrentUserAdmin && !isMemberAdmin) {
          return (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveMember(member)}
              >
                Remove
              </Button>
            </div>
          )
        }

        // Non-admin can only leave (their own row)
        if (!isCurrentUserAdmin && isCurrentUser) {
          return (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={showLeaveModal}>
                Leave
              </Button>
            </div>
          )
        }

        return null
      },
    },
  ]

  return (
    <DashboardBody
      wrapperClassName="max-w-(--breakpoint-sm)!"
      className="flex flex-col gap-y-8"
      header={
        <Button onClick={openInviteMemberModal} variant="default">
          <Add className="mr-2" fontSize="small" />
          <span>Invite</span>
        </Button>
      }
    >
      <p className="dark:text-polar-500 text-gray-500">
        Manage users who have access to this organization. All members are
        entitled to view and manage organization settings, products,
        subscriptions, etc.
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
    </DashboardBody>
  )
}

function InviteMemberModal({
  organizationId,
  onClose,
}: {
  organizationId: string
  onClose: () => void
}) {
  const { toast } = useToast()
  const [email, setEmail] = useState('')
  const inviteMember = useInviteOrganizationMember(organizationId)

  const handleInvite = async () => {
    if (!email) return

    try {
      const result = await inviteMember.mutateAsync(email)
      if (result.response.status == 200) {
        toast({
          title: 'Member already added',
          description: 'User is already a member of this organization',
        })
      } else if (result.data) {
        toast({
          title: 'Member added',
          description: 'User successfully added to organization',
        })
        onClose()
      } else if (result.error) {
        toast({
          title: 'Invite failed',
          description: 'Failed to invite user. Please try again.',
        })
      }
    } catch {
      toast({
        title: 'Invite failed',
        description: 'Failed to invite user. Please try again.',
      })
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleInvite()
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-y-6 p-8">
      <h3 className="text-lg font-medium">Invite User</h3>
      <Input
        type="email"
        placeholder="Enter email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoFocus
      />
      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={!email || inviteMember.isPending}
          loading={inviteMember.isPending}
        >
          Send Invite
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
