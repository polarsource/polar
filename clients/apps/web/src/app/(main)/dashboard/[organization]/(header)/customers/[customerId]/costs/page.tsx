import { CustomerCosts } from '@/components/Customer/CustomerPage/CustomerCosts'
import { CustomerPageShell } from '@/components/Customer/CustomerPage/CustomerPageShell'
import { Metadata } from 'next'
import {
  CustomerPageParams,
  generateCustomerMetadata,
  getOrganizationAndCustomerOrNotFound,
} from '../getCustomer'

export async function generateMetadata(props: {
  params: Promise<CustomerPageParams>
}): Promise<Metadata> {
  return generateCustomerMetadata(await props.params, 'Costs')
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
      <CustomerCosts organization={organization} customer={customer} />
    </CustomerPageShell>
  )
}
