import { redirect } from 'next/navigation'

export default function UsageBillingPage({
  params,
}: {
  params: { organization: string }
}) {
  redirect(`/dashboard/${params.organization}/usage-billing/meters`)
}
