import { StaticImage } from '@/components/Image/StaticImage'

export const Dashboard = () => {
  return (
    <div className="flex flex-col items-center gap-y-12 px-4 md:gap-y-16 md:px-0">
      <div className="flex max-w-3xl flex-col items-center gap-y-6 text-center">
        <h2 className="font-display text-4xl leading-tight text-gray-900 md:text-6xl dark:text-white">
          Built for the people building what&apos;s next
        </h2>
        <p className="dark:text-polar-400 max-w-2xl text-lg text-gray-500 md:text-xl">
          A dashboard that gets out of your way. Track revenue, customers, and
          checkouts in real time, so you can focus on shipping.
        </p>
      </div>
      <div className="dark:bg-polar-900 dark:border-polar-700 relative w-full overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
        <StaticImage
          src="/assets/landing/iso-dash.jpeg"
          alt="Polar dashboard"
          width={3840}
          height={2160}
          className="block h-auto w-full"
          sizes="(min-width: 1280px) 1280px, 100vw"
          priority
        />
      </div>
    </div>
  )
}
