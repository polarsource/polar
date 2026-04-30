import { schemas } from '@polar-sh/client'
import type { ColorToken } from '@polar-sh/orbit/theme'
import { Box } from '@polar-sh/orbit/Box'
import {
  CheckIcon,
  ClockIcon,
  MinusIcon,
  XIcon,
  type LucideIcon,
} from 'lucide-react'

const STATUS_ICONS: Record<
  schemas['OrganizationReviewCheckStatus'],
  LucideIcon
> = {
  passed: CheckIcon,
  failed: XIcon,
  warning: MinusIcon,
  pending: ClockIcon,
}

const STATUS_TOKENS: Record<
  schemas['OrganizationReviewCheckStatus'],
  { backgroundColor: ColorToken; color: ColorToken }
> = {
  passed: { backgroundColor: 'background-success', color: 'text-success' },
  failed: { backgroundColor: 'background-danger', color: 'text-danger' },
  warning: { backgroundColor: 'background-warning', color: 'text-warning' },
  pending: { backgroundColor: 'background-pending', color: 'text-pending' },
}

const CHILD_ICON_COLOR_CLASS: Record<
  schemas['OrganizationReviewCheckStatus'],
  string
> = {
  passed: 'text-gray-900 dark:text-gray-100',
  failed: 'text-red-600 dark:text-red-400',
  warning: 'text-yellow-500 dark:text-yellow-300',
  pending: 'text-gray-500 dark:text-polar-400',
}

interface Props {
  status: schemas['OrganizationReviewCheckStatus']
  variant: 'parent' | 'child'
}

export const StatusIcon = ({ status, variant }: Props) => {
  const Icon = STATUS_ICONS[status]

  if (variant === 'child') {
    return (
      <Icon className={`h-4 w-4 shrink-0 ${CHILD_ICON_COLOR_CLASS[status]}`} />
    )
  }

  const tokens = STATUS_TOKENS[status]

  return (
    <Box
      display="flex"
      width={24}
      height={24}
      flexShrink={0}
      alignItems="center"
      justifyContent="center"
      borderRadius="full"
      backgroundColor={tokens.backgroundColor}
      color={tokens.color}
    >
      <Icon className="h-3.5 w-3.5" />
    </Box>
  )
}
