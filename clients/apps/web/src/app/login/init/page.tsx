import Redirector from '@/components/Auth/Redirector'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Redirecting...',
}

export default function Page() {
  return <Redirector />
}
