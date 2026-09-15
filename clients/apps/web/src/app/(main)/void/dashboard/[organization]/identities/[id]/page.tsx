import { VoidIdentityPage } from '@/components/Void/VoidIdentityPage'
import { Metadata } from 'next'

export const metadata: Metadata = { title: 'Identity' }

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  return <VoidIdentityPage identityId={id} />
}
