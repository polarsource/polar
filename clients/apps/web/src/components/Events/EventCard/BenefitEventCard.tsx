import {
  benefitsDisplayNames,
  resolveBenefitIcon,
} from '@/components/Benefit/utils'
import { useBenefit } from '@/hooks/queries'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { schemas } from '@polar-sh/client'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import Link from 'next/link'
import { useContext, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import { EventCardBase } from './EventCardBase'
import { UserEventCard } from './UserEventCard'

export interface BenefitGrantEventCardProps {
  event:
    | schemas['BenefitGrantedEvent']
    | schemas['BenefitCycledEvent']
    | schemas['BenefitUpdatedEvent']
    | schemas['BenefitRevokedEvent']
}

export const BenefitEventCard = ({ event }: BenefitGrantEventCardProps) => {
  const { organization } = useContext(OrganizationContext)
  const { data: benefit, isLoading: isLoadingBenefit } = useBenefit(
    event.metadata.benefit_id,
  )

  const status = useMemo(() => {
    switch (event.name) {
      case 'benefit.granted':
        return [
          'Granted',
          'bg-emerald-100 text-emerald-500 dark:bg-emerald-950 dark:text-emerald-500',
        ]
      case 'benefit.cycled':
        return [
          'Cycled',
          'bg-yellow-100 text-yellow-500 dark:bg-yellow-950 dark:text-yellow-500',
        ]
      case 'benefit.updated':
        return [
          'Updated',
          'bg-blue-100 text-blue-500 dark:bg-blue-950 dark:text-blue-500',
        ]
      case 'benefit.revoked':
        return [
          'Revoked',
          'bg-red-100 text-red-500 dark:bg-red-950 dark:text-red-500',
        ]
      default:
        return null
    }
  }, [event.name])

  return (
    <EventCardBase loading={isLoadingBenefit}>
      {benefit ? (
        <Link
          href={`/dashboard/${organization.slug}/products/benefits/${benefit.id}`}
          className="flex flex-grow flex-row items-center justify-between gap-x-12"
        >
          <div className="flex flex-row items-center gap-x-4 px-1.5 py-2">
            <div className="flex flex-row items-center gap-x-6">
              {resolveBenefitIcon(benefit.type, 'h-3 w-3')}
              <span className="">{benefit.description ?? '—'}</span>
            </div>
            <span className="dark:text-polar-500 text-gray-500">
              {benefitsDisplayNames[benefit.type]}
            </span>
          </div>
          {status ? (
            <Status
              status={status[0]}
              className={twMerge(status[1], 'text-xs')}
            />
          ) : null}
        </Link>
      ) : (
        <UserEventCard event={event} />
      )}
    </EventCardBase>
  )
}
