import { buildMetadata } from '@/utils/metadata'

export const metadata = buildMetadata({
  path: '/company',
  title: 'Company',
  description:
    'Small team, big ambitions. Learn about Polar, our open roles, and the investors who back us.',
  image:
    'https://polar.sh/api/og?title=Company&description=Small+team%2C+big+ambitions.',
})

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
