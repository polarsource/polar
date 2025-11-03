'use client'

import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Link from 'next/link'
import { useEffect, useMemo } from 'react'
import { Gradient } from './GradientMesh'
import { computeComplementaryColor } from './utils'

interface StorefrontHeaderProps {
  organization: schemas['Organization']
}

export const StorefrontHeader = ({ organization }: StorefrontHeaderProps) => {
  const gradient = useMemo(
    () => (typeof window !== 'undefined' ? new Gradient() : undefined),
    [],
  )

  useEffect(() => {
    if (!gradient) {
      return
    }

    const root = document.documentElement

    const [a, b, c, d] = computeComplementaryColor('#121316')

    root.style.setProperty('--gradient-color-1', `#${a.toHex()}`)
    root.style.setProperty('--gradient-color-2', `#${b.toHex()}`)
    root.style.setProperty('--gradient-color-3', `#${c.toHex()}`)
    root.style.setProperty('--gradient-color-4', `#${d.toHex()}`)

    /* @ts-ignore */
    gradient.initGradient('#gradient-canvas')
  }, [gradient, organization])

  return (
    <div className="flex w-full grow flex-col items-center gap-y-6">
      <div className="relative aspect-3/1 w-full rounded-2xl bg-gray-100 md:aspect-4/1 md:rounded-4xl dark:bg-black">
        <canvas
          id="gradient-canvas"
          className="absolute top-0 right-0 bottom-0 left-0 h-full w-full rounded-2xl md:rounded-4xl"
        />
        <Avatar
          className="dark:border-polar-950 absolute -bottom-16 left-1/2 h-32 w-32 -translate-x-1/2 border-8 border-white text-lg md:text-5xl"
          name={organization.name}
          avatar_url={organization.avatar_url}
        />
      </div>
      <div className="mt-16 flex grow flex-col items-center">
        <div className="flex flex-col items-center md:gap-y-1">
          <h1 className="text-xl md:text-3xl">{organization.name}</h1>
          <Link
            className="dark:text-polar-500 text-gray-500"
            href={`/${organization.slug}`}
            tabIndex={-1}
          >
            @{organization.slug}
          </Link>
        </div>
      </div>
      <div className="flex w-full grow flex-col items-center">
        <div className="flex w-full grow flex-col items-center gap-y-6"></div>
      </div>
    </div>
  )
}
