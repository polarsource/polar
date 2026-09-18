import { VoidSignalPage } from '@/components/Void/VoidSignalPage'
import { Metadata } from 'next'

export const metadata: Metadata = { title: 'Signal' }

export default async function Page(props: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await props.params
  return <VoidSignalPage slug={decodeURIComponent(slug)} />
}
