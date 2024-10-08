'use client'

import GetStartedButton from '@/components/Auth/GetStartedButton'

export const Hero = () => {
  return (
    <div className="flex w-full flex-col items-center gap-24 md:pb-16">
      <div className="relative z-20 flex w-full flex-col items-center gap-y-12 text-center">
        <div className="z-20 flex flex-col items-center gap-y-8">
          <h1 className="text-balance text-5xl !leading-tight text-gray-950 md:text-7xl dark:text-white">
            Launch SaaS, Products & Memberships in minutes
          </h1>
          <div className="flex flex-col items-center gap-y-4 xl:w-2/3">
            <p className="dark:text-polar-400 text-balance text-xl leading-relaxed text-gray-500">
              Merchant of Record - Leave upsales, billing and international
              taxes to us.
            </p>
          </div>
        </div>
        <div className="z-20 flex flex-row items-center gap-x-4">
          <div className="dark:bg-polar-800 flex flex-row items-center gap-x-2 rounded-full bg-gray-50 py-2 pl-6 pr-2">
            <div className="flex flex-row items-center gap-x-0.5">
              <span>polar.sh/</span>
              <input
                autoFocus
                className="w-44 border-none border-transparent bg-transparent p-0 focus:border-transparent focus:ring-0"
                placeholder="my-organization"
              />
            </div>
            <GetStartedButton
              wrapperClassNames="p-0"
              className="px-4 py-3 text-sm"
            />
          </div>
        </div>
      </div>
      <div>
        <video
          src="/assets/landing/polar_ui_2.webm"
          width="100%"
          className="dark:border-polar-700 xl:rounded-4xl aspect-video rounded-2xl border border-gray-200 lg:rounded-3xl"
          autoPlay
          playsInline
          muted
        />
      </div>
    </div>
  )
}
