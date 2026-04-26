import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { JetBrains_Mono } from 'next/font/google'
import './globals.css'

const soehne = localFont({
  variable: '--font-sans',
  src: [
    {
      path: '../public/fonts/test-soehne-leicht.woff2',
      weight: '300',
      style: 'normal',
    },
    {
      path: '../public/fonts/test-soehne-buch.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../public/fonts/test-soehne-kraftig.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../public/fonts/test-soehne-dreiviertelfett.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
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
      className={`${soehne.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body
        className={`${soehne.className} dark:text-dark-200 flex min-h-full flex-col bg-white text-neutral-600 dark:bg-black`}
      >
        {children}
      </body>
    </html>
  )
}
