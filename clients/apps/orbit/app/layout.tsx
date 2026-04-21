import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  axes: ['opsz'],
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Polar — Billing infrastructure for AI',
  description:
    'From inference to invoice. Usage-based billing, wallets, and revenue automation for AI products.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body
        className={`${inter.className} dark:text-dark-200 flex min-h-full flex-col bg-white text-neutral-600 dark:bg-black`}
      >
        {children}
      </body>
    </html>
  )
}
