import { Metadata } from 'next'
import ClientPage from './ClientPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Webhooks', // " | Polar is added by the template"
  }
}

export default function Page() {
  return <ClientPage />
}
