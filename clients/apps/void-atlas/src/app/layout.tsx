import './globals.css'

import type { Metadata } from 'next'
import { cookies } from 'next/headers'

export const metadata: Metadata = {
  title: { default: 'Void Atlas', template: '%s / Void Atlas' },
  description: 'Short interactive lessons on how Void works.',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const theme = (await cookies()).get('theme')?.value
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={theme === 'dark' ? 'dark antialiased' : 'antialiased'}
    >
      <body className="min-h-dvh">{children}</body>
    </html>
  )
}
