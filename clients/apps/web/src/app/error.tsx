'use client'

import InternalServerError from '@/components/Shared/InternalServerError'
import { inter } from '@/fonts/fonts'
import * as Sentry from '@sentry/nextjs'
import { GeistMono } from 'geist/font/mono'
import { useEffect } from 'react'

export default function Error({ error }: { error: Error }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html className={`antialiased ${inter.variable} ${GeistMono.variable}`}>
      <body>
        <InternalServerError
          digest={'digest' in error ? (error.digest as string) : undefined}
        />
      </body>
    </html>
  )
}
