'use client'

import { cn } from '@/lib/utils'
import { ComponentProps, useState } from 'react'

const Avatar = ({
  name,
  avatar_url,
  className,
  height,
  width,
}: {
  name: string
  avatar_url: string | null
  className?: string
  height?: number | undefined
  width?: number | undefined
}) => {
  const initials = getInitials(name)

  // We render the image with opacity: 0 until it's successfully loaded.
  // Not doing so can result in a flash of the `alt` text when a 404
  // is returned from browser cache.
  const [hasLoaded, setHasLoaded] = useState(false)
  const [showInitials, setShowInitials] = useState(avatar_url === null)

  const onLoad = () => {
    setHasLoaded(true)
    setShowInitials(false)
  }

  const onError = () => {
    setShowInitials(true)
    setHasLoaded(true)
  }

  return (
    <div
      className={cn(
        'dark:bg-polar-900 dark:border-polar-700 relative z-[2] flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-gray-200 bg-gray-50 text-sm',
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
          <img
            alt={name}
            src={avatar_url}
            height={height}
            width={width}
            onLoad={onLoad}
            onError={onError}
            className={cn(
              'z-[1] aspect-square rounded-full object-cover',
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
