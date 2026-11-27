import {
  benefitsDisplayNames,
  resolveBenefitIcon,
} from '@/components/Benefit/utils'
import { useBenefit } from '@/hooks/queries'
import { useDashboardOrganization } from '@/hooks/dashboardOrganization'
import { schemas } from '@polar-sh/client'
import { Status, type StatusColor } from '@polar-sh/orbit'
import Link from 'next/link'
import { useMemo } from 'react'
import { EventCardBase } from './EventCardBase'
import { UserEventCard } from './UserEventCard'

export interface BenefitGrantEventCardProps {
  event:
    | schemas['BenefitGrantedEvent']
    | schemas['BenefitCycledEvent']
    | schemas['BenefitUpdatedEvent']
    | schemas['BenefitRevokedEvent']
    | schemas['BenefitManuallyGrantedEvent']
    | schemas['BenefitManuallyRevokedEvent']
    | schemas['BenefitUnrevokedEvent']
}

export const BenefitEventCard = ({ event }: BenefitGrantEventCardProps) => {
  const organization = useDashboardOrganization()
  const { data: benefit, isLoading: isLoadingBenefit } = useBenefit(
    event.metadata.benefit_id,
  )

  const status = useMemo((): [string, StatusColor] | null => {
    switch (event.name) {
      case 'benefit.granted':
        return ['Granted', 'green']
      case 'benefit.cycled':
        return ['Cycled', 'yellow']
      case 'benefit.updated':
        return ['Updated', 'blue']
      case 'benefit.revoked':
        return ['Revoked', 'red']
      case 'benefit.manually_granted':
        return ['Manually Granted', 'green']
      case 'benefit.manually_revoked':
        return ['Manually Revoked', 'red']
      case 'benefit.unrevoked':
        return ['Unrevoked', 'green']
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
            <Status status={status[0]} color={status[1]} size="small" />
          ) : null}
        </Link>
      ) : (
        <UserEventCard event={event} />
      )}
    </EventCardBase>
  )
}
