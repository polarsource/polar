import { CustomerMembers } from '@/components/Customer/CustomerPage/CustomerMembers'
import { CustomerPageShell } from '@/components/Customer/CustomerPage/CustomerPageShell'
import { isCustomerMembersEnabled } from '@/components/Customer/CustomerPage/isCustomerMembersEnabled'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  CustomerPageParams,
  generateCustomerMetadata,
  getOrganizationAndCustomerOrNotFound,
} from '../getCustomer'

export async function generateMetadata(props: {
  params: Promise<CustomerPageParams>
}): Promise<Metadata> {
  return generateCustomerMetadata(await props.params, 'Members')
}

export default async function Page(props: {
  params: Promise<CustomerPageParams>
}) {
  const params = await props.params
  const { organization, customer } =
    await getOrganizationAndCustomerOrNotFound(params)

  if (!isCustomerMembersEnabled(organization, customer)) {
    notFound()
  }

  return (
    <CustomerPageShell
      key={customer.id}
      organization={organization}
      customer={customer}
    >
      <CustomerMembers organization={organization} customer={customer} />
    </CustomerPageShell>
  )
}
