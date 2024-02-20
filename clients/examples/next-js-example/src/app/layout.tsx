import LogoIcon from '@/components/LogoIcon'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Link from 'next/link'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Polar Next.js Example',
  description: 'An example of using Polar with Next.js',
}

export default function RootLayout({
  children,
  params: { slug },
}: Readonly<{
  children: React.ReactNode
  params: { slug: string }
}>) {
  console.log(slug)
  return (
    <html lang="en">
      <body className={`${inter.className} m-4 bg-slate-50`}>
        <header className="flex flex-row items-center justify-center py-12">
          <div className="relative flex w-full max-w-2xl flex-col items-center justify-center gap-y-4 text-blue-600">
            <Link href="/">
              <LogoIcon className="h-12 w-12" />
            </Link>
          </div>
        </header>
        {children}
      </body>
    </html>
  )
}
