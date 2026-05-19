import { useToast } from '@/components/Toast/use-toast'
import { useInviteOrganizationMember } from '@/hooks/queries/org'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import { useState } from 'react'

export function InviteMemberModal({
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
      if (result.response.status === 200) {
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
