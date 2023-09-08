import Status from '@/components/Pledge/Status'
import { notFound } from 'next/navigation'
import { api } from 'polarkit'
import { ApiError, Pledge } from 'polarkit/api/client'

export default async function Page({
  searchParams,
  params,
}: {
  params: {
    organization: string
    repo: string
    number: string
    payment_intent_id: string
  }
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const paymentIntentId = searchParams['payment_intent_id']
  if (typeof paymentIntentId !== 'string') {
    notFound()
  }

  let pledge: Pledge

  try {
    pledge = await api.pledges.create({
      requestBody: {
        payment_intent_id: paymentIntentId,
      },
    })
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 404) {
        notFound()
      }
    }
    throw e
  }

  // TODO: Handle different statuses than success... #happy-path-alpha-programming

  return <Status pledge={pledge} />
}
