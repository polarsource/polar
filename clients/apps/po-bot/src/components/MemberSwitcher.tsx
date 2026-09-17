'use client'

import type { Member } from '@/db/schema'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/orbit'
import { useRouter } from 'next/navigation'

/** Who you are. Switching goes to that member's workspace. */
export const MemberSwitcher = ({
  members,
  current,
}: {
  members: readonly Member[]
  current: string
}) => {
  const router = useRouter()
  return (
    <Select
      value={current}
      onValueChange={(id) => router.push(`/members/${id}`)}
    >
      <SelectTrigger className="h-8 w-full text-xs" aria-label="Member">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {members.map((member) => (
          <SelectItem key={member.id} value={member.id}>
            {member.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
