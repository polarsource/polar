'use client'

import { useAnonymousCustomerName } from '@/utils/anonymousCustomer'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import { DetailRow } from '../Shared/DetailRow'
import { AnonymousCustomerAvatar } from './AnonymousCustomerAvatar'

interface AnonymousCustomerContextViewProps {
  externalCustomerId: string
}

export const AnonymousCustomerContextView = ({
  externalCustomerId,
}: AnonymousCustomerContextViewProps) => {
  const [name] = useAnonymousCustomerName(externalCustomerId)

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto">
      <ShadowBox className="dark:border-polar-800 flex flex-col gap-6 border-gray-200 bg-white p-6 md:shadow-xs lg:rounded-2xl">
        <div className="flex flex-row items-center gap-4">
          <AnonymousCustomerAvatar
            externalId={externalCustomerId}
            className="size-12"
          />
          <div className="flex flex-col">
            <p className="text-base">{name}</p>
          </div>
        </div>
      </ShadowBox>
      <ShadowBox className="dark:border-polar-800 flex flex-col gap-4 border-gray-200 bg-white p-6 md:gap-0 md:shadow-xs lg:rounded-2xl">
        <DetailRow
          labelClassName="flex-none md:basis-24"
          valueClassName="font-mono"
          label="External ID"
          value={externalCustomerId}
        />
      </ShadowBox>
    </div>
  )
}
