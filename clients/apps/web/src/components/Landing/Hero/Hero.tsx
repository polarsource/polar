'use client'

import GetStartedButton from '@/components/Auth/GetStartedButton'
import { useCallback, useMemo, useState } from 'react'

export const Hero = () => {
  const [slug, setSlug] = useState('')

  const slugify = useCallback(
    (str: string) =>
      str
        .toLowerCase()
        .replace(/[\s_-]+/g, '-')
        .trim(),
    [],
  )

  const isPhone = useMemo(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined')
      return false

    return /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(
      navigator.userAgent,
    )
  }, [])

  return (
    <div className="flex w-full flex-col items-center gap-24 md:pb-16">
      <div className="relative z-20 flex w-full flex-col items-center gap-y-12 text-center">
        <div className="z-20 flex flex-col items-center gap-y-8">
          <h1 className="text-balance text-5xl !leading-tight text-gray-950 md:text-7xl dark:text-white">
            Sell digital products &amp; subscriptions in minutes
          </h1>
          <div className="flex flex-col items-center xl:w-2/3">
            <p className="dark:text-polar-400 text-balance text-xl leading-relaxed text-gray-500">
              Focus on shipping your product - leave international taxes, upsales &amp; billing to us.
            </p>
            <p className="hidden dark:text-polar-400 text-balance text-xl leading-relaxed text-gray-500 md:block">
              Polar is a merchant of record trusted by thousands of developers &amp; startups.
            </p>
          </div>
        </div>
        <div className="flex flex-col items-center gap-y-4">
          <div className="z-20 flex flex-row items-center gap-x-4">
            <div
              className="dark:bg-polar-800 dark:border-polar-700 flex flex-row items-center gap-x-2 rounded-full border bg-gray-50 py-2 pl-6 pr-2"
              role="form"
            >
              <div className="flex flex-row items-center gap-x-0.5">
                <span>polar.sh/</span>
                <input
                  autoFocus={!isPhone}
                  className="w-44 border-none border-transparent bg-transparent p-0 focus:border-transparent focus:ring-0"
                  placeholder="product-name"
                  value={slug}
                  onChange={(e) => setSlug(slugify(e.target.value))}
                />
              </div>
              <GetStartedButton className="px-3" orgSlug={slug} size="default" text="Start for free" />
            </div>
          </div>
          <p className="hidden dark:text-polar-500 text-balance text-xs text-gray-500 md:block">
            Up and running in two minutes. We only earn once you do - 4% + 40¢ per transaction.
          </p>
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
