import { Metadata } from 'next'
import CLITokenPage from './CLITokenPage'

export const metadata: Metadata = {
  title: 'Create access token',
}

export default function Page() {
  return <CLITokenPage />
}
