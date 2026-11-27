'use client'

import InternalServerError from '@/components/Shared/InternalServerError'
import { reloadOnStaleChunk } from '@/utils/staleChunk'
import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({ error }: { error: Error }) {
  useEffect(() => {
    if (reloadOnStaleChunk(error)) return
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en" translate="no" className="antialiased">
      <body>
        <InternalServerError
          digest={'digest' in error ? (error.digest as string) : undefined}
        />
      </body>
    </html>
  )
}
