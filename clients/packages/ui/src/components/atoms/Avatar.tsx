import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'

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

  const [showInitials, setShowInitials] = useState(avatar_url === null)

  const onError = () => {
    setShowInitials(true)
  }

  useEffect(() => {
    setShowInitials(avatar_url === null)
  }, [avatar_url])

  return (
    <div
      className={twMerge(
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
            onError={onError}
            className="z-[1] aspect-square rounded-full object-cover"
          />
        </>
      )}
    </div>
  )
}

export default Avatar

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
