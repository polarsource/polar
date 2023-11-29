import { Metadata, ResolvingMetadata } from 'next'
import ClientPage from './ClientPage'

export async function generateMetadata(
  {
    params,
  }: {
    params: { organization: string }
  },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  return {
    title: `Finance - Incoming`, // " | Polar is added by the template"
  }
}

export default async function Page() {
  return <ClientPage />
}
