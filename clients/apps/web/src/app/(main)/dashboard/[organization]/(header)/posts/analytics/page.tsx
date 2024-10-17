import { Metadata } from 'next'
import ClientPage from './ClientPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Newsletter Analytics', // " | Polar is added by the template"
  }
}

export default function Page() {
  return <ClientPage />
}
