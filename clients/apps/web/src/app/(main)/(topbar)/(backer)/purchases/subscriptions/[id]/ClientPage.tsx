'use client'

import CustomerPortalSubscription from '@/components/CustomerPortal/CustomerPortalSubscription'
import { api } from '@/utils/client'
import { ArrowBackOutlined } from '@mui/icons-material'
import { schemas } from '@polar-sh/client'
import Link from 'next/link'

const ClientPage = ({
  subscription,
  products,
}: {
  subscription: schemas['CustomerSubscription']
  products: schemas['CustomerProduct'][]
}) => {
  return (
    <div className="flex flex-col gap-y-8">
      <Link
        className="flex flex-row items-center gap-2 self-start text-sm text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
        href={`/purchases/subscriptions`}
      >
        <ArrowBackOutlined fontSize="inherit" />
        <span>Back to Purchases</span>
      </Link>
      <CustomerPortalSubscription
        api={api}
        products={products}
        subscription={subscription}
      />
    </div>
  )
}

export default ClientPage
