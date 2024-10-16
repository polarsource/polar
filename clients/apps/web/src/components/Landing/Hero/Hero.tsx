'use client'

import GetStartedButton from '@/components/Auth/GetStartedButton'
import { useCallback, useMemo, useState } from 'react'

export const OrganizationForm = () => {
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
    <div
      className="dark:bg-polar-800 dark:border-polar-700 flex flex-row items-center gap-x-2 rounded-full border bg-gray-50 py-2 pl-6 pr-2"
      role="form"
    >
      <div className="flex flex-row items-center gap-x-0.5">
        <span>polar.sh/</span>
        <input
          autoFocus={!isPhone}
          className="w-44 border-none border-transparent bg-transparent p-0 focus:border-transparent focus:ring-0"
          placeholder="my-organization"
          value={slug}
          onChange={(e) => setSlug(slugify(e.target.value))}
        />
      </div>
      <GetStartedButton className="px-3" orgSlug={slug} size="default" />
    </div>
  )
}

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
          <OrganizationForm />
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
