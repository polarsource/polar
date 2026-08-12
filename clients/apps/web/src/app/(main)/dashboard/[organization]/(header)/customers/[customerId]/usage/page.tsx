import { CustomerPageShell } from '@/components/Customer/CustomerPage/CustomerPageShell'
import { CustomerUsageView } from '@/components/Customer/CustomerPage/CustomerUsageView'
import { Metadata } from 'next'
import {
  CustomerPageParams,
  generateCustomerMetadata,
  getOrganizationAndCustomerOrNotFound,
} from '../getCustomer'

export async function generateMetadata(props: {
  params: Promise<CustomerPageParams>
}): Promise<Metadata> {
  return generateCustomerMetadata(await props.params, 'Usage')
}

export default async function Page(props: {
  params: Promise<CustomerPageParams>
}) {
  const params = await props.params
  const { organization, customer } =
    await getOrganizationAndCustomerOrNotFound(params)

  return (
    <CustomerPageShell
      key={customer.id}
      organization={organization}
      customer={customer}
    >
      <CustomerUsageView organization={organization} customer={customer} />
    </CustomerPageShell>
  )
}
