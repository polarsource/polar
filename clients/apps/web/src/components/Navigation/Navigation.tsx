import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import { twMerge } from 'tailwind-merge'

export const ListItem = (props: {
  children: React.ReactElement<any>
  current: boolean
  className?: string
}) => {
  const className = twMerge(
    'animate-background duration-10 flex items-center gap-2 py-2 px-2 w-full rounded-full transition-colors',
    props.current
      ? 'bg-blue-50 dark:bg-polar-800 text-blue-500 dark:text-blue-50'
      : 'hover:text-blue-500 dark:hover:text-polar-50',
    props.className ?? '',
  )

  return <li className={className}>{props.children}</li>
}

export const Profile = (props: { name: string; avatar_url: string | null }) => {
  return (
    <>
      <div className="flex w-full min-w-0 shrink grow-0 items-center justify-between text-sm">
        <div className="flex w-full min-w-0 shrink grow-0 items-center">
          <Avatar
            name={props.name}
            avatar_url={props.avatar_url}
            className="h-8 w-8 rounded-full"
          />
          <p className="ml-4 truncate">{props.name}</p>
        </div>
      </div>
    </>
  )
}

export const LinkItem = (props: {
  href: string
  icon?: React.ReactElement<any>
  children: React.ReactElement<any>
}) => {
  return (
    <a href={props.href}>
      <ListItem current={false} className="rounded-lg px-4">
        <div className="flex flex-row items-center gap-x-2 text-sm">
          <span className="text-lg">{props.icon}</span>
          {props.children}
        </div>
      </ListItem>
    </a>
  )
}

export const TextItem = (props: {
  onClick: () => void
  icon: React.ReactElement<any>
  children: React.ReactElement<any>
}) => {
  return (
    <div
      className="flex cursor-pointer items-center text-sm"
      onClick={props.onClick}
    >
      <ListItem current={false} className="gap-x-2 px-4 py-0 text-sm">
        <>
          <span className="text-lg">{props.icon}</span>
          {props.children}
        </>
      </ListItem>
    </div>
  )
}
