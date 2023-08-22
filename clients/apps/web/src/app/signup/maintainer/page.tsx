import MaintainerSignup from '@/components/Auth/MaintainerSignup'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Signup to Polar',
}

export default function Page() {
  return <MaintainerSignup />
}
