const Avatar = ({
  name,
  avatar_url,
}: {
  name: string
  avatar_url: string | undefined
}) => {
  if (avatar_url) {
    {
      /* eslint-disable-next-line @next/next/no-img-element */
    }
    return (
      <img
        src={avatar_url}
        className="h-6 w-6 flex-shrink-0 rounded-full border-2 border-white bg-white dark:border-gray-900 dark:bg-gray-900"
      />
    )
  }

  const initials = getInitials(name)

  return (
    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-white bg-white text-xs dark:border-gray-900 dark:bg-gray-900">
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
