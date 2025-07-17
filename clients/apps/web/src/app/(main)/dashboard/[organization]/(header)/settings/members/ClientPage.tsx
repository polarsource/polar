'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
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
import { useState } from 'react'

export default function ClientPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const { data: members, isLoading } = useListOrganizationMembers(
    organization.id,
  )
  const [showInviteDialog, setShowInviteDialog] = useState(false)

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
    <DashboardBody wide>
      <div className="flex items-center justify-between">
        <div>Manage users who have access to this organization</div>
        <Button onClick={() => setShowInviteDialog(true)} variant="default">
          <Add fontSize="small" /> Invite User
        </Button>
      </div>

      <div className="mt-8">
        {members && (
          <DataTable
            columns={columns}
            data={members.items}
            isLoading={isLoading}
          />
        )}
      </div>

      {showInviteDialog && (
        <InviteDialog
          organizationId={organization.id}
          onClose={() => setShowInviteDialog(false)}
        />
      )}
    </DashboardBody>
  )
}

function InviteDialog({
  organizationId,
  onClose,
}: {
  organizationId: string
  onClose: () => void
}) {
  const [email, setEmail] = useState('')
  const inviteMember = useInviteOrganizationMember(organizationId)

  const handleInvite = async () => {
    if (!email) return

    try {
      const result = await inviteMember.mutateAsync(email)
      if (result.data) {
        onClose()
      } else if (result.error) {
        console.error('Failed to invite user:', result.error)
        alert('Failed to invite user. Please try again.')
      }
    } catch (error) {
      console.error('Failed to invite user:', error)
      alert('Failed to invite user. Please try again.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 dark:bg-gray-900">
        <h3 className="mb-4 text-lg font-medium">Invite User</h3>
        <input
          type="email"
          placeholder="Enter email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700"
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleInvite}
            disabled={!email || inviteMember.isPending}
            loading={inviteMember.isPending}
          >
            Send Invite
          </Button>
        </div>
      </div>
    </div>
  )
}
