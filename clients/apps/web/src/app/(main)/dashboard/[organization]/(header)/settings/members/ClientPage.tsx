'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { Modal } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import { useToast } from '@/components/Toast/use-toast'
import { useAuth } from '@/hooks/auth'
import {
  useInviteOrganizationMember,
  useListOrganizationMembers,
  useRemoveOrganizationMember,
} from '@/hooks/queries/org'
import Add from '@mui/icons-material/Add'
import ClearOutlined from '@mui/icons-material/ClearOutlined'
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
import { useState } from 'react'

export default function ClientPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const { currentUser } = useAuth()
  const { data: members, isLoading } = useListOrganizationMembers(
    organization.id,
  )
  const {
    show: openInviteMemberModal,
    hide: hideInviteMemberModal,
    isShown: isInviteMemberModalShown,
  } = useModal()
  const {
    show: openRemoveMemberModal,
    hide: hideRemoveMemberModal,
    isShown: isRemoveMemberModalShown,
  } = useModal()
  const [memberToRemove, setMemberToRemove] =
    useState<schemas['OrganizationMember'] | null>(null)

  const handleRemoveClick = (member: schemas['OrganizationMember']) => {
    setMemberToRemove(member)
    openRemoveMemberModal()
  }

  // Check if the current user is the admin
  const currentUserMember = members?.items.find(
    (m) => currentUser && m.user_id === currentUser.id,
  )
  const isCurrentUserAdmin = currentUserMember?.is_admin ?? false

  const columns: DataTableColumnDef<schemas['OrganizationMember']>[] = [
    {
      id: 'member',
      accessorKey: 'email',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="User" />
      ),
      cell: ({ row: { original: member } }) => {
        return (
          <div className="flex flex-row items-center gap-2">
            <Avatar avatar_url={member.avatar_url} name={member.email} />
            <div className="fw-medium">
              {member.email}
              {member.is_admin && (
                <span className="dark:text-polar-500 ml-2 text-sm text-gray-500">
                  (Admin)
                </span>
              )}
            </div>
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
      cell: ({ row: { original: member } }) => {
        // Only show remove button if current user is admin and the member is not an admin
        if (!isCurrentUserAdmin || member.is_admin) {
          return null
        }
        return (
          <div className="flex justify-end">
            <Button
              className={
                'border-none bg-transparent text-[16px] opacity-50 transition-opacity hover:opacity-100 dark:bg-transparent'
              }
              size="icon"
              variant="secondary"
              onClick={() => handleRemoveClick(member)}
            >
              <ClearOutlined fontSize="inherit" />
            </Button>
          </div>
        )
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

      <Modal
        className="max-w-(--breakpoint-sm)!"
        modalContent={
          <RemoveMemberModal
            organizationId={organization.id}
            member={memberToRemove}
            onClose={hideRemoveMemberModal}
          />
        }
        isShown={isRemoveMemberModalShown}
        hide={hideRemoveMemberModal}
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
    } catch (error) {
      toast({
        title: 'Invite failed',
        description: 'Failed to invite user. Please try again.',
      })
    }
  }

  return (
    <div className="flex w-full flex-col gap-y-6 p-8">
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
          onClick={handleInvite}
          disabled={!email || inviteMember.isPending}
          loading={inviteMember.isPending}
        >
          Send Invite
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

function RemoveMemberModal({
  organizationId,
  member,
  onClose,
}: {
  organizationId: string
  member: schemas['OrganizationMember'] | null
  onClose: () => void
}) {
  const { toast } = useToast()
  const removeMember = useRemoveOrganizationMember(organizationId)

  const handleRemove = async () => {
    if (!member) return

    try {
      const result = await removeMember.mutateAsync(member.user_id)
      if (result.error) {
        toast({
          title: 'Failed to remove member',
          description:
            result.error.detail || 'Failed to remove member. Please try again.',
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Member removed',
          description: `${member.email} has been removed from the organization`,
        })
        onClose()
      }
    } catch (error) {
      toast({
        title: 'Failed to remove member',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      })
    }
  }

  if (!member) return null

  return (
    <div className="flex w-full flex-col gap-y-6 p-8">
      <h3 className="text-lg font-medium">Remove Member</h3>
      <p className="dark:text-polar-400 text-gray-600">
        Are you sure you want to remove <strong>{member.email}</strong> from
        this organization? They will lose access to all organization resources.
      </p>
      <div className="flex gap-2">
        <Button
          onClick={handleRemove}
          disabled={removeMember.isPending}
          loading={removeMember.isPending}
          variant="destructive"
        >
          Remove Member
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
