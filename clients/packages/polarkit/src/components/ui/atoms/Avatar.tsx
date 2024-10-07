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
  if (avatar_url) {
    {
      /* eslint-disable-next-line @next/next/no-img-element */
    }
    return (
      <img
        src={avatar_url}
        className={twMerge(
          'dark:bg-polar-900 dark:border-polar-800 h-6 w-6 flex-shrink-0 rounded-full border-2 border-white bg-white',
          className,
        )}
        height={height}
        width={width}
      />
    )
  }

  const initials = getInitials(name)

  return (
    <div
      className={twMerge(
        'dark:bg-polar-900 dark:border-polar-800 border-gray-75 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 bg-white text-xs',
        className,
      )}
    >
      <span>{initials}</span>
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
