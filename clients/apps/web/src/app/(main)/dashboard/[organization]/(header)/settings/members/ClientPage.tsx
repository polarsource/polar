'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { Modal } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import { useToast } from '@/components/Toast/use-toast'
import {
  useInviteOrganizationMember,
  useListOrganizationMembers,
} from '@/hooks/queries/org'
import { Add } from '@mui/icons-material'
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
  const { data: members, isLoading } = useListOrganizationMembers(
    organization.id,
  )
  const {
    show: openInviteMemberModal,
    hide: hideInviteMemberModal,
    isShown: isInviteMemberModalShown,
  } = useModal()

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
            <div className="fw-medium">{member.email}</div>
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
  ]

  return (
    <DashboardBody
      wrapperClassName="!max-w-screen-sm"
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
        className="!max-w-screen-sm"
        modalContent={
          <InviteMemberModal
            organizationId={organization.id}
            onClose={hideInviteMemberModal}
          />
        }
        isShown={isInviteMemberModalShown}
        hide={hideInviteMemberModal}
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
