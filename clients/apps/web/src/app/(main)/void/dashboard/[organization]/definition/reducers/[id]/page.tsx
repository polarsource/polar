import { VoidReducerPage } from '@/components/Void/VoidReducerPage'
import { Metadata } from 'next'

export const metadata: Metadata = { title: 'Reducer' }

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  return <VoidReducerPage reducerId={decodeURIComponent(id)} />
}
