'use client'

import { CheckoutLinkPage } from '@/components/CheckoutLinks/CheckoutLinkPage'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useCheckoutLink } from '@/hooks/queries'
import { parseAsString, useQueryState } from 'nuqs'
import { CheckoutLinkList } from './CheckoutLinkList'

export const ClientPage = () => {
  const [selectedCheckoutLinkId, setSelectedCheckoutLinkId] = useQueryState(
    'checkoutLinkId',
    parseAsString,
  )

  const { data: checkoutLink } = useCheckoutLink(selectedCheckoutLinkId)

  return (
    <DashboardBody
      className="flex flex-col gap-y-8"
      contextViewClassName="w-full lg:max-w-[320px] xl:max-w-[320px] h-full overflow-y-hidden"
      contextView={
        <CheckoutLinkList
          selectedCheckoutLinkId={selectedCheckoutLinkId}
          setSelectedCheckoutLinkId={setSelectedCheckoutLinkId}
        />
      }
      contextViewPlacement="left"
      title={checkoutLink?.label ?? ''}
      wrapperClassName="!max-w-screen-sm"
    >
      {checkoutLink && <CheckoutLinkPage checkoutLink={checkoutLink} />}
    </DashboardBody>
  )
}
