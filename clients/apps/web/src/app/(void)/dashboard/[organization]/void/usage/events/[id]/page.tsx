import { Metadata } from 'next'
import ClientPage from './ClientPage'

export const metadata: Metadata = {
  title: 'Event',
  robots: {
    index: false,
    follow: false,
  },
}

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  return <ClientPage eventId={params.id} />
}
