'use client'

import { Facehash } from 'facehash'
import { useCallback, useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

// ─── Size scale ───────────────────────────────────────────────────────────────

const SIZES = {
  sm: 24,
  md: 32,
  lg: 40,
  xl: 48,
} as const

export type AvatarSize = keyof typeof SIZES

// ─── Props ────────────────────────────────────────────────────────────────────

export type AvatarProps = {
  /** Name of the person — used for the Facehash fallback and alt text. */
  name: string
  /** Avatar image URL. When null/undefined the Facehash fallback renders. */
  src?: string | null
  /** Size token. Defaults to 'md' (32 px). */
  size?: AvatarSize
  className?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const px = SIZES[size]

  const [hasLoaded, setHasLoaded] = useState(false)
  const [showFallback, setShowFallback] = useState(!src)
  const imgRef = useRef<HTMLImageElement>(null)

  const onLoad = useCallback(() => {
    setHasLoaded(true)
    setShowFallback(false)
  }, [])

  const onError = useCallback(() => {
    setShowFallback(true)
    setHasLoaded(true)
  }, [])

  // Detect images already in the browser cache
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setHasLoaded(true)
      setShowFallback(false)
    }
  }, [])

  return (
    <div
      className={twMerge(
        'relative shrink-0 overflow-hidden rounded-full',
        className,
      )}
      style={{ width: px, height: px }}
    >
      {/* Inset ring for visual definition against any background */}
      <span className="absolute inset-0 z-10 rounded-full ring-1 ring-black/10 ring-inset dark:ring-white/10" />

      {showFallback || !src ? (
        <Facehash
          name={name}
          size={px}
          colorClasses={[
            'bg-emerald-500',
            'bg-rose-500',
            'bg-blue-500',
            'bg-amber-500',
          ]}
          enableBlink
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          alt={name}
          src={src}
          width={px}
          height={px}
          onLoad={onLoad}
          onError={onError}
          className={twMerge(
            'aspect-square h-full w-full rounded-full object-cover transition-opacity duration-150',
            hasLoaded ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
    </div>
  )
}
