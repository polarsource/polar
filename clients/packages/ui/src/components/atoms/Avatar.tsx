'use client'

import { cn } from '@/lib/utils'
import {
  ComponentProps,
  ComponentType,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

const Avatar = ({
  name,
  avatar_url,
  className,
  height,
  width,
  loading = 'eager',
  CustomImageComponent,
}: {
  name: string
  avatar_url: string | null
  className?: string
  height?: number | undefined
  width?: number | undefined
  loading?: React.ImgHTMLAttributes<HTMLImageElement>['loading']
  CustomImageComponent?: ComponentType<any> // Used mainly to pass next/image
}) => {
  const initials = getInitials(name)

  // We render the image with opacity: 0 until it's successfully loaded.
  // Not doing so can result in a flash of the `alt` text when a 404
  // is returned from browser cache.
  const [hasLoaded, setHasLoaded] = useState(false)
  const [showInitials, setShowInitials] = useState(avatar_url === null)

  const onLoad = useCallback(() => {
    setHasLoaded(true)
    setShowInitials(false)
  }, [setHasLoaded, setShowInitials])

  const imgRef = useRef<HTMLImageElement>(null)

  const onError = useCallback(() => {
    setShowInitials(true)
    setHasLoaded(true)
  }, [setHasLoaded, setShowInitials])

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
      className={cn(
        'dark:bg-polar-900 dark:border-polar-700 relative z-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-gray-200 bg-gray-50 text-sm',
        className,
      )}
    >
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
            className={cn(
              'z-1 aspect-square rounded-full object-cover',
              hasLoaded ? 'opacity-100' : 'opacity-0',
            )}
          />
        </>
      )}
    </div>
  )
}

const AvatarWrapper = (props: ComponentProps<typeof Avatar>) => {
  return <Avatar {...props} key={props.avatar_url} />
}

export default AvatarWrapper

const getInitials = (fullName: string) => {
  const allNames = fullName.trim().split(' ')
  const initials = allNames.reduce((acc, curr, index) => {
    if (index === 0 || index === allNames.length - 1) {
      acc = `${acc}${curr.charAt(0).toUpperCase()}`
    }
    return acc
  }, '')
  return initials
}
