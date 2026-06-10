'use client'

import { schemas } from '@polar-sh/client'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import { twMerge } from 'tailwind-merge'
import { useTranslations } from './PortalLocaleProvider'

const OrderStatusDisplayColor: Record<schemas['Order']['status'], string> = {
  draft: 'bg-gray-100 text-gray-500 dark:bg-gray-900 dark:text-gray-400',
  paid: 'bg-emerald-100 text-emerald-500 dark:bg-emerald-950 dark:text-emerald-500',
  pending:
    'bg-yellow-100 text-yellow-500 dark:bg-yellow-950 dark:text-yellow-500',
  refunded:
    'bg-violet-100 text-violet-500 dark:bg-violet-950 dark:text-violet-400',
  partially_refunded:
    'bg-violet-100 text-violet-500 dark:bg-violet-950 dark:text-violet-400',
  void: 'bg-red-100 text-red-500 dark:bg-red-950 dark:text-red-400',
}

export const OrderStatus = ({
  status,
  size,
}: {
  status: schemas['Order']['status']
  size?: 'small' | 'medium'
}) => {
  const t = useTranslations()

  const displayTitle: Record<schemas['Order']['status'], string> = {
    draft: t('portal.orders.statusTitle.draft'),
    paid: t('portal.orders.statusTitle.paid'),
    pending: t('portal.orders.statusTitle.pending'),
    refunded: t('portal.orders.statusTitle.refunded'),
    partially_refunded: t('portal.orders.statusTitle.partiallyRefunded'),
    void: t('portal.orders.statusTitle.void'),
  }

  return (
    <Status
      className={twMerge(OrderStatusDisplayColor[status], 'w-fit')}
      status={displayTitle[status]}
      size={size}
    />
  )
}
