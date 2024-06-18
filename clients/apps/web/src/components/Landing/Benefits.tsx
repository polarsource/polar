import {
  FileDownloadOutlined,
  StickyNote2Outlined,
  TuneOutlined,
  VerifiedOutlined,
} from '@mui/icons-material'
import { twMerge } from 'tailwind-merge'
import { DiscordIcon } from '../Benefit/utils'
import GitHubIcon from '../Icons/GitHubIcon'

interface BenefitCardProps {
  className?: string
  title: string
  description: string
  icon: JSX.Element
}

const BenefitCard = ({
  className,
  title,
  description,
  icon,
}: BenefitCardProps) => {
  return (
    <div
      className={twMerge(
        'hover:bg-gray-75 dark:hover:bg-polar-900 dark:bg-polar-950 flex flex-col justify-between gap-y-8 bg-white p-8 transition-colors',
        className,
      )}
    >
      <span>{icon}</span>
      <div className="flex flex-col gap-y-2">
        <h3>{title}</h3>
        <p className="dark:text-polar-200 text-gray-500">{description}</p>
      </div>
    </div>
  )
}

export const Benefits = () => {
  return (
    <>
      <div className="flex flex-col items-center gap-y-4">
        <h1 className="text-center text-4xl">
          Offer developer benefits in seconds
        </h1>
        <p className="dark:text-polar-200 text-center text-xl text-gray-500">
          Common upsells are delightfully built-in and automated.
        </p>
      </div>
      <div className="grid grid-cols-1 overflow-hidden rounded-3xl border md:grid-cols-3">
        <BenefitCard
          className="border-b md:border-r"
          icon={<GitHubIcon width={30} height={30} />}
          title="Private GitHub Repositories"
          description=""
        />
        <BenefitCard
          className="border-b md:border-r"
          icon={
            <FileDownloadOutlined className="text-4xl" fontSize="inherit" />
          }
          title="File Downloads"
          description=""
        />
        <BenefitCard
          className="border-b md:border-r"
          icon={<StickyNote2Outlined className="text-4xl" fontSize="inherit" />}
          title="Free & Premium Newsletters"
          description=""
        />
        <BenefitCard
          className="border-b md:border-r"
          icon={<DiscordIcon size={30} />}
          title="Discord Invites & Roles"
          description=""
        />
        <BenefitCard
          className="border-b md:border-b-0 md:border-r"
          icon={<VerifiedOutlined className="text-4xl" fontSize="inherit" />}
          title="Sponsor Promotion"
          description=""
        />
        <BenefitCard
          icon={<TuneOutlined className="text-4xl" fontSize="inherit" />}
          title="Custom Benefit"
          description=""
        />
      </div>
    </>
  )
}
