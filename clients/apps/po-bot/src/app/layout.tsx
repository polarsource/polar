import '@/styles/globals.css'

import type { Metadata } from 'next'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: { default: 'Po Bot', template: '%s / Po Bot' },
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" suppressHydrationWarning className="antialiased">
      <body style={{ height: '100dvh' }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
