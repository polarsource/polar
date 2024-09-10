'use client'

import GetStartedButton from '@/components/Auth/GetStartedButton'
import Button from 'polarkit/components/ui/atoms/button'

export const Hero = () => {
  return (
    <div className="flex w-full flex-col items-center gap-24 md:pb-16">
      <div className="relative z-20 flex w-full flex-col items-center gap-y-12 text-center">
        <div className="z-20 flex flex-col items-center gap-y-8">
          <h1 className="text-balance text-5xl !leading-tight text-gray-950 md:text-7xl dark:text-white">
            The best monetization platform for developers
          </h1>
          <div className="flex flex-col items-center gap-y-4 xl:w-2/3">
            <p className="dark:text-polar-400 text-lg leading-relaxed text-gray-500">
              Get paid coding on your passion. Leave upsales, billing and international taxes to us.
            </p>
          </div>
        </div>
        <div className="z-20 flex flex-row items-center gap-x-4">
          {/* <div className="dark:bg-polar-800 flex flex-row items-center gap-x-2 rounded-full bg-white py-2 pl-6 pr-2">
            <div className="flex flex-row items-center gap-x-0.5">
              <span>polar.sh/</span>
              <input
                autoFocus
                className="border-none border-transparent bg-transparent p-0 focus:border-transparent focus:ring-0"
                placeholder="my-organization"
              />
            </div>
            <GetStartedButton
              wrapperClassNames="p-0"
              className="px-4 py-2 text-sm"
            />
          </div> */}
          <GetStartedButton />
          <a target="_blank" href="https://github.com/polarsource/polar">
            <Button size="lg" variant="ghost">
              Star on GitHub
            </Button>
          </a>
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

        <div className="mt-6 flex space-x-12 justify-center items-center">
          <a
            href="https://www.producthunt.com/posts/polar-5?embed=true&utm_source=badge-featured&utm_medium=badge&utm_souce=badge-polar&#0045;5"
            target="_blank"
          >
            <img
              src="/assets/landing/ph_pod.svg"
              alt="Polar - An&#0032;open&#0032;source&#0032;monetization&#0032;platform&#0032;for&#0032;developers | Product Hunt"
              style={{ height: '37px' }}
              height="37"
            />
          </a>
          <p className="text-lg leading-relaxed">
            Trusted by thousands of developers shipping world-wide
          </p>
        </div>
      </div>
    </div>
  )
}
