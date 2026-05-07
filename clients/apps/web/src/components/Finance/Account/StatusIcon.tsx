import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import type {
  BackgroundColorToken,
  TextColorToken,
} from '@polar-sh/orbit/theme'
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

type ReviewCheckStatusAppearance = {
  backgroundColor: BackgroundColorToken
  color: TextColorToken
}

const STATUS_APPEARANCE: Record<
  schemas['OrganizationReviewCheckStatus'],
  ReviewCheckStatusAppearance
> = {
  passed: { backgroundColor: 'background-success', color: 'text-success' },
  failed: { backgroundColor: 'background-danger', color: 'text-danger' },
  warning: { backgroundColor: 'background-warning', color: 'text-warning' },
  pending: { backgroundColor: 'background-pending', color: 'text-pending' },
}

interface Props {
  status: schemas['OrganizationReviewCheckStatus']
}

export const StatusIcon = ({ status }: Props) => {
  const Icon = STATUS_ICONS[status]
  const appearance = STATUS_APPEARANCE[status]

  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      width={24}
      height={24}
      flexShrink={0}
      borderRadius="full"
      backgroundColor={appearance.backgroundColor}
      color={appearance.color}
    >
      <Icon className="h-3.5 w-3.5" />
    </Box>
  )
}
