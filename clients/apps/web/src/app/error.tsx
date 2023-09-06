'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <html>
      <body className="bg-blue-100">
        <div className="flex grow flex-col items-center justify-center p-8">
          <h2 className="text-xl">Something went wrong!</h2>
          <a className="text-blue-500 underline" href="/">
            Go back to Polar
          </a>

          <pre className="mt-12 text-sm">{error.message}</pre>
        </div>
      </body>
    </html>
  )
}
