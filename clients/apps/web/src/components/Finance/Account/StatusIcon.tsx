import { schemas } from '@polar-sh/client'
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

const ICON_COLOR_CLASS: Record<
  schemas['OrganizationReviewCheckStatus'],
  string
> = {
  passed:
    'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  failed: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  warning:
    'bg-yellow-100 text-yellow-500 dark:bg-yellow-900/30 dark:text-yellow-300',
  pending: 'bg-gray-100 text-gray-500 dark:bg-polar-800 dark:text-polar-400',
}

interface Props {
  status: schemas['OrganizationReviewCheckStatus']
}

export const StatusIcon = ({ status }: Props) => {
  const Icon = STATUS_ICONS[status]

  return (
    <div
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${ICON_COLOR_CLASS[status]}`}
    >
      <Icon className="h-3.5 w-3.5" />
    </div>
  )
}
