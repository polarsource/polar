'use client'

import type { Member } from '@/db/schema'
import {
  Avatar,
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  Text,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Building2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

const ORGANIZATION = '__organization'

/**
 * Who you are, styled like the dashboard's organization switcher: a quiet row
 * with an avatar that opens the list. The organization overview is the last
 * entry, so the sidebar needs no separate back button.
 */
export const MemberSwitcher = ({
  members,
  current,
}: {
  members: readonly Member[]
  current: string
}) => {
  const router = useRouter()
  const me = members.find((member) => member.id === current)
  return (
    <Select
      value={current}
      onValueChange={(id) =>
        router.push(id === ORGANIZATION ? '/' : `/members/${id}`)
      }
    >
      <SelectTrigger
        className="dark:hover:bg-polar-800 h-10 w-full rounded-xl border-transparent bg-transparent px-2 shadow-none hover:border-transparent hover:bg-gray-200 dark:bg-transparent dark:hover:border-transparent"
        aria-label="Member"
      >
        <SelectValue>
          <Box alignItems="center" columnGap="s" minWidth={0}>
            <Avatar
              name={me?.name ?? ''}
              avatar_url={null}
              className="h-6 w-6 text-[10px]"
            />
            <Text variant="label" as="span" truncate>
              {me?.name}
            </Text>
          </Box>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {members.map((member) => (
          <SelectItem key={member.id} value={member.id}>
            <Box alignItems="center" columnGap="s">
              <Avatar
                name={member.name}
                avatar_url={null}
                className="h-5 w-5 text-[9px]"
              />
              <span>{member.name}</span>
            </Box>
          </SelectItem>
        ))}
        <SelectSeparator />
        <SelectItem value={ORGANIZATION}>
          <Box alignItems="center" columnGap="s">
            <Building2 size={14} />
            <span>Organization overview</span>
          </Box>
        </SelectItem>
      </SelectContent>
    </Select>
  )
}
