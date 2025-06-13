import Link from 'next/link'

export interface JobLinkProps {
  role: string
  description: string
  location: string
  link: string
}

export const JobLink = ({
  role,
  description,
  location,
  link,
}: JobLinkProps) => {
  return (
    <Link
      className="dark:border-polar-700 dark:hover:bg-polar-900 flex flex-col items-start justify-between border border-gray-300 p-8 text-sm text-gray-500 transition-colors hover:bg-white"
      href={link}
      target="_blank"
    >
      <div className="flex flex-col gap-2">
        <h3 className="my-0 text-lg font-bold">{role}</h3>
        <p className="dark:text-polar-500 text-lg text-gray-500">
          {description}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-indigo-500" />
        <span className="text-black dark:text-white">{location}</span>
      </div>
    </Link>
  )
}
