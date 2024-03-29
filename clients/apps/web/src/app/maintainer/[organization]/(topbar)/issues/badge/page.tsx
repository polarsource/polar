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
    title: `Promote ${params.organization} issues`, // " | Polar is added by the template"
  }
}

export default function Page() {
  return <ClientPage />
}
