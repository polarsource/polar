'use client'

export default function Error({ error }: { error: Error }) {
  return (
    <div className="flex grow flex-col items-center justify-center p-8">
      <h2 className="text-xl">Something went wrong!</h2>
      <a className="text-blue-500 underline" href="/purchases/products">
        Go back to purchases
      </a>

      <pre className="mt-12 text-sm">{error.message}</pre>
    </div>
  )
}
