import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Seat-Based Pricing Example - Polar',
  description: 'Example implementation of seat-based pricing using Polar SDK',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
