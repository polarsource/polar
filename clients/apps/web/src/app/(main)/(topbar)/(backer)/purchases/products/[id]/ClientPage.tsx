'use client'

import CustomerPortalOrder from '@/components/CustomerPortal/CustomerPortalOrder'
import { api } from '@/utils/api'
import { ArrowBackOutlined } from '@mui/icons-material'
import { CustomerOrder } from '@polar-sh/sdk'
import Link from 'next/link'

const ClientPage = ({ order }: { order: CustomerOrder }) => {
  return (
    <div className="flex flex-col gap-y-8">
      <Link
        className="flex flex-row items-center gap-2 self-start text-sm text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
        href={`/purchases/products`}
      >
        <ArrowBackOutlined fontSize="inherit" />
        <span>Back to Purchases</span>
      </Link>
      <CustomerPortalOrder api={api} order={order} />
    </div>
  )
}

export default ClientPage
