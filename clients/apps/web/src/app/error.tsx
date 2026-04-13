'use client'

import InternalServerError from '@/components/Shared/InternalServerError'
import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function Error({ error }: { error: Error }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html className="antialiased">
      <body>
        <InternalServerError
          digest={'digest' in error ? (error.digest as string) : undefined}
        />
      </body>
    </html>
  )
}
