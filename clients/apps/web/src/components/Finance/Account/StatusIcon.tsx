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

interface Props {
  status: schemas['OrganizationReviewCheckStatus']
  variant: 'parent' | 'child'
}

export const StatusIcon = ({ status, variant }: Props) => {
  const Icon = STATUS_ICONS[status]

  if (variant === 'child') {
    return (
      <Icon className="dark:text-polar-200 h-4 w-4 shrink-0 text-gray-900" />
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
