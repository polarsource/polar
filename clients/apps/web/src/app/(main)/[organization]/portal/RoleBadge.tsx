'use client'

import { twMerge } from 'tailwind-merge'

type MemberRole = 'owner' | 'billing_manager' | 'member'

const roleConfig: Record<MemberRole, { label: string; className: string }> = {
  owner: {
    label: 'Owner',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  },
  billing_manager: {
    label: 'Billing',
    className:
      'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  },
  member: {
    label: 'Member',
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  },
}

export const RoleBadge = ({ role }: { role: MemberRole }) => {
  const config = roleConfig[role]

  return (
    <span
      className={twMerge(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        config.className,
      )}
    >
      {config.label}
    </span>
  )
}
