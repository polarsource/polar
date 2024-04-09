import { Metadata } from 'next'
import ClientPage from './ClientPage'

export async function generateMetadata({
  params,
}: {
  params: { organization: string }
}): Promise<Metadata> {
  return {
    title: `Promote ${params.organization} issues`, // " | Polar is added by the template"
  }
}

export default function Page() {
  return <ClientPage />
}
