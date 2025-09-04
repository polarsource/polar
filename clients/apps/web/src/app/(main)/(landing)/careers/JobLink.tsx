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
      className="group flex flex-col justify-between gap-y-2 py-6"
      href={link}
      target="_blank"
    >
      <h4>{role}</h4>
      <p className="dark:text-polar-500 text-gray-500 transition-colors duration-200 group-hover:text-black dark:group-hover:text-white">
        {description}
      </p>
      <span className="text-indigo-500">{location}</span>
    </Link>
  )
}
