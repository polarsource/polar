import { redirect } from 'next/navigation'

export default async function UsageBillingPage(
  props: {
    params: Promise<{ organization: string }>
  }
) {
  const params = await props.params;
  redirect(`/dashboard/${params.organization}/usage-billing/meters`)
}
