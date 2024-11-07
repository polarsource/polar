'use client'

import GetStartedButton from '@/components/Auth/GetStartedButton'
import { Canvas } from '@react-three/fiber'
import { useCallback, useMemo, useState } from 'react'
import { Coins } from './Coins'

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
    <div className="flex w-full flex-col items-center justify-center gap-12 text-center">
      <Canvas
        camera={{
          zoom: 0.8,
        }}
      >
        <Coins />
      </Canvas>
      <h1 className="max-w-2xl text-pretty text-4xl !leading-tight text-gray-950 md:text-6xl dark:text-white">
        Sell SaaS and digital products{' '}
        <span className="dark:text-polar-500 text-gray-400">in minutes</span>
      </h1>
      <div className="flex flex-row items-center gap-x-4">
        <div
          className="dark:bg-polar-800 dark:border-polar-700 shadow-3xl hidden flex-row items-center gap-x-2 rounded-full border bg-gray-50 py-2 pl-6 pr-2 md:flex"
          role="form"
        >
          <div className="flex flex-row items-center gap-x-0.5">
            <span className="md:text-xl">polar.sh/</span>
            <input
              autoFocus={!isPhone}
              className="dark:placeholder:text-polar-500 w-44 border-none border-transparent bg-transparent p-0 placeholder:text-gray-300 focus:border-transparent focus:ring-0 md:text-xl"
              placeholder="my-app"
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
            />
          </div>
          <GetStartedButton orgSlug={slug} size="lg" text="Get Started" />
        </div>

        <div className="flex flex-col gap-y-2 md:hidden">
          <div
            className="dark:bg-polar-800 dark:border-polar-700 shadow-3xl flex flex-row items-center rounded-full border bg-gray-50 px-4 py-2"
            role="form"
          >
            <span className="md:text-xl">polar.sh/</span>
            <input
              autoFocus={!isPhone}
              className="dark:placeholder:text-polar-500 w-44 border-none border-transparent bg-transparent p-0 placeholder:text-gray-300 focus:border-transparent focus:ring-0 md:text-xl"
              placeholder="my-app"
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
            />
          </div>
          <GetStartedButton
            fullWidth
            orgSlug={slug}
            size="lg"
            text="Get Started"
          />
        </div>
      </div>
    </div>
  )
}
