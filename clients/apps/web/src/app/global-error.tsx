'use client'
import * as Sentry from '@sentry/nextjs'
import Error from 'next/error'
import { useEffect } from 'react'

import Button from '@polar-sh/ui/components/atoms/Button'

export default function GlobalError({ error }: { error: Error }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body className="bg-blue-100">
        <div className="flex grow flex-col items-center justify-center space-y-4 p-16">
          <h2 className="text-xl">Something went wrong!</h2>

          <Button
            fullWidth={false}
            onClick={() => {
              window.location.href = '/'
            }}
          >
            <span>Go back to Polar</span>
          </Button>

          <p className="pt-24 text-gray-400"></p>

          <pre className="text-sm whitespace-break-spaces text-gray-400">
            Error digest: {'digest' in error ? <>{error.digest}</> : 'oh oh'}
          </pre>
        </div>
      </body>
    </html>
  )
}
