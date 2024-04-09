import Status from '@/components/Pledge/Status'
import { Pledge, ResponseError } from '@polar-sh/sdk'
import { notFound } from 'next/navigation'
import { api } from 'polarkit'

export default async function Page({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const paymentIntentId = searchParams['payment_intent_id']
  if (typeof paymentIntentId !== 'string') {
    notFound()
  }

  let pledge: Pledge

  try {
    pledge = await api.pledges.create({
      createPledgeFromPaymentIntent: {
        payment_intent_id: paymentIntentId,
      },
    })
  } catch (e) {
    if (e instanceof ResponseError) {
      if (e.response.status === 404) {
        notFound()
      }
    }
    throw e
  }

  const email = searchParams['email'] as string | undefined

  // TODO: Handle different statuses than success... #happy-path-alpha-programming

  return <Status pledge={pledge} email={email} />
}
