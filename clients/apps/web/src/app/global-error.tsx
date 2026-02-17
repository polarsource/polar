'use client'

import InternalServerError from '@/components/Shared/InternalServerError'
import * as Sentry from '@sentry/nextjs'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import { useEffect } from 'react'

export default function GlobalError({ error }: { error: Error }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html className={`antialiased ${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <InternalServerError
          digest={'digest' in error ? (error.digest as string) : undefined}
        />
      </body>
    </html>
  )
}
