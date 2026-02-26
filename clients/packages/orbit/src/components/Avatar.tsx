'use client'

import {
  type ComponentType,
  type ImgHTMLAttributes,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { twMerge } from 'tailwind-merge'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AvatarProps = {
  name: string
  avatar_url: string | null
  className?: string
  height?: number
  width?: number
  loading?: ImgHTMLAttributes<HTMLImageElement>['loading']
  /** Pass next/image or any other image component. Defaults to <img>. */
  CustomImageComponent?: ComponentType<any>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getInitials = (fullName: string) => {
  const allNames = fullName
    .split('@')[0] // In case it's passed an email
    .replace(/[^a-zA-Z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
  return allNames.reduce((acc, curr, index) => {
    if (index === 0 || index === allNames.length - 1) {
      acc = `${acc}${curr.charAt(0).toUpperCase()}`
    }
    return acc
  }, '')
}

// ─── Component ────────────────────────────────────────────────────────────────

const AvatarInner = ({
  name,
  avatar_url,
  className,
  height,
  width,
  loading = 'eager',
  CustomImageComponent,
}: AvatarProps) => {
  const initials = getInitials(name)

  // We render the image with opacity: 0 until it's successfully loaded.
  // Not doing so can result in a flash of the `alt` text when a 404
  // is returned from browser cache.
  const [hasLoaded, setHasLoaded] = useState(false)
  const [showInitials, setShowInitials] = useState(avatar_url === null)

  const onLoad = useCallback(() => {
    setHasLoaded(true)
    setShowInitials(false)
  }, [])

  const imgRef = useRef<HTMLImageElement>(null)

  const onError = useCallback(() => {
    setShowInitials(true)
    setHasLoaded(true)
  }, [])

  // We need to look at the `.complete`-property on the <img>
  // in order to detect resources in the cache.
  useEffect(() => {
    if (imgRef.current && imgRef.current.complete) {
      setHasLoaded(true)
      setShowInitials(false)
    }
  }, [imgRef.current])

  const ImageElement = CustomImageComponent || 'img'

  return (
    <div
      className={twMerge(
        'dark:bg-polar-900 dark:border-polar-700 dark:text-polar-500 relative z-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-50 font-sans text-[10px] text-gray-700',
        className,
      )}
    >
      <span className="absolute inset-0 z-2 rounded-full ring ring-black/10 ring-inset dark:ring-white/10" />
      {!avatar_url || showInitials ? (
        <div className="absolute inset-0 flex items-center justify-center bg-transparent">
          <span>{initials}</span>
        </div>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <ImageElement
            ref={imgRef}
            alt={name}
            src={avatar_url}
            height={height}
            width={width}
            loading={loading}
            onLoad={onLoad}
            onError={onError}
            className={twMerge(
              'z-1 aspect-square rounded-full object-cover',
              hasLoaded ? 'opacity-100' : 'opacity-0',
            )}
          />
        </>
      )}
    </div>
  )
}

// Re-mount on avatar_url change to avoid stale opacity state
export const Avatar = (props: AvatarProps) => (
  <AvatarInner {...props} key={props.avatar_url} />
)

export default Avatar
