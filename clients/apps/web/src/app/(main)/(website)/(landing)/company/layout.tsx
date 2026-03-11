import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Company — Polar',
  description:
    'Small team, big ambitions. Learn about Polar, our open roles, and the investors who back us.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
