import GetStartedButton from '@/components/Auth/GetStartedButton'

export default function PricingCTA() {
  return (
    <div className="not-prose mt-16 flex flex-col items-center gap-y-4 py-8">
      <h2 className="text-pretty text-center text-2xl text-gray-700 md:text-3xl md:!leading-tight dark:text-white">
        Start selling in minutes
      </h2>

      <p className="max-w-sm text-center text-gray-500 dark:text-gray-400">
        We pride ourselves on being the fastest way to integrate payments into
        your stack.
      </p>

      <GetStartedButton
        size="lg"
        className="rounded-full bg-white font-medium text-black hover:bg-gray-100 dark:bg-white dark:text-black"
      />
    </div>
  )
}
