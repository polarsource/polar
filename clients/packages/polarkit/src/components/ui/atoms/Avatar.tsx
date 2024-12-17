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
  const isGravatar = avatar_url && avatar_url.includes("gravatar.com")
  // Always add initials below image in case of Gravatar since they return a transparent image if the user does not have a Gravatar account
  const showInitials = isGravatar || !avatar_url

  return (
    <div
      className={twMerge(
        'dark:bg-polar-900 dark:border-polar-700 relative z-[2] flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-gray-200 bg-gray-50 text-sm',
        className,
      )}
    >
      {showInitials && (
        <div className="absolute inset-0 flex items-center justify-center bg-transparent">
          <span>{initials}</span>
        </div>
      )}
      {avatar_url && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={name}
            src={avatar_url}
            height={height}
            width={width}
            className="z-[1] rounded-full"
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
