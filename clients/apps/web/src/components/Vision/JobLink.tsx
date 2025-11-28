import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined'
import Link from 'next/link'

export interface JobLinkProps {
  role: string
  experience?: string
  description: string
  location: string
  link: string
}

export const JobLink = ({
  role,
  experience,
  description,
  location,
  link,
}: JobLinkProps) => {
  return (
    <Link
      className="lg:group-hover:text-polar-500 group/link hover:text-polar-50! border-polar-600 grid grid-cols-1 gap-6 text-sm md:border-t lg:grid-cols-4 lg:py-4"
      href={link}
      target="_blank"
    >
      <div className="col-span-1 flex h-fit flex-col">
        <h4 className="text-base md:text-sm">{role}</h4>
      </div>
      <div className="col-span-2 flex flex-col gap-y-4">
        <div className="flex flex-col">
          <p>{location}</p>
          {experience && (
            <p className="dark:text-polar-500 group-hover/link:text-polar-100 text-gray-500">
              {experience}
            </p>
          )}
        </div>
        <p className="dark:text-polar-500 group-hover/link:text-polar-100 text-gray-500">
          {description}
        </p>
      </div>
      <div className="col-span-1 flex items-end justify-end gap-2">
        <div className="flex flex-row items-center gap-2 opacity-0 lg:group-hover/link:opacity-100">
          <span>Enroll</span>
          <ArrowForwardOutlined fontSize="inherit" />
        </div>
      </div>
    </Link>
  )
}
