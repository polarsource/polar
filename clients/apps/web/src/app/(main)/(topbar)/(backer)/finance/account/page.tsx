import { Metadata } from 'next'
import ClientPage from './ClientPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `Finance - Payout account`, // " | Polar is added by the template"
  }
}

export default async function Page() {
  return <ClientPage />
}
