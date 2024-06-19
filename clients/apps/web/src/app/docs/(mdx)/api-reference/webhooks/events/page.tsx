import Webhooks from '@/components/Documentation/Webhooks'
import { fetchSchema } from '@/components/Documentation/openapi'

export default async function Page() {
  const schema = await fetchSchema()

  return (
    <>
      <h1>Webhook events</h1>
      <p>
        You&apos;ll find below the list of events we may send to your webhook
        endpoint, along with their payload structure.
      </p>
      <Webhooks schema={schema} />
    </>
  )
}
