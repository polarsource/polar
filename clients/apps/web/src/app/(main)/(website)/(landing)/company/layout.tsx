import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Company',
  description:
    'Small team, big ambitions. Learn about Polar, our open roles, and the investors who back us.',
  openGraph: {
    title: 'Company',
    description:
      'Small team, big ambitions. Learn about Polar, our open roles, and the investors who back us.',
    images: [
      {
        url: 'https://polar.sh/api/og?title=Company&description=Small+team%2C+big+ambitions.',
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Company',
    description:
      'Small team, big ambitions. Learn about Polar, our open roles, and the investors who back us.',
    images: [
      'https://polar.sh/api/og?title=Company&description=Small+team%2C+big+ambitions.',
    ],
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
