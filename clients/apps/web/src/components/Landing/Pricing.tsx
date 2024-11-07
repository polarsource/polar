import Link from 'next/link'

export const Pricing = () => {
  return (
    <div className="dark:bg-polar-950 rounded-4xl flex w-full flex-col gap-y-12 bg-gray-50 p-8 md:p-16 dark:md:bg-[radial-gradient(400px_at_top,rgba(20,20,25,1)_0%,rgba(7,7,9,1)_100%)]">
      <div className="flex flex-col items-center gap-y-6">
        <span className="dark:text-polar-500 text-lg text-gray-400">
          Early Member
        </span>
        <h1 className="w-fit max-w-xl text-pretty text-center text-2xl md:text-4xl md:leading-normal">
          Pricing
        </h1>
      </div>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        <div className="dark:bg-polar-900 flex w-full flex-col gap-y-4 rounded-3xl bg-gray-100 p-8">
          <div className="flex flex-row items-center gap-x-3">
            <h1 className="text-xl">4% + 40¢ per transaction</h1>
          </div>
          <p className="dark:text-polar-400 text-gray-600">
            We only earn when you do.{' '}
            <Link href="/docs/fees" className="text-blue-500">
              See how our fees apply.
            </Link>
          </p>
        </div>
        <div className="dark:bg-polar-900 flex w-full flex-col gap-y-4 rounded-3xl bg-gray-100 p-8">
          <div className="flex flex-row items-center gap-x-3">
            <h1 className="text-xl">Zero Fixed Costs</h1>
          </div>
          <p className="dark:text-polar-400 text-gray-600">
            No surprises. No hidden or monthly costs.
          </p>
        </div>
        <div className="dark:bg-polar-900 flex w-full flex-col gap-y-4 rounded-3xl bg-gray-100 p-8">
          <div className="flex flex-row items-center gap-x-3">
            <h1 className="text-xl">Volume Pricing</h1>
          </div>
          <p className="dark:text-polar-400 text-gray-600">
            Large or fast-growing business? Reach out to us.
          </p>
        </div>
      </div>
    </div>
  )
}
