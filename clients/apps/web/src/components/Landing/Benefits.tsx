import {
  FileDownloadOutlined,
  StickyNote2Outlined,
  TuneOutlined,
  WebOutlined,
} from '@mui/icons-material'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import { DiscordIcon } from '../Benefit/utils'
import GitHubIcon from '../Icons/GitHubIcon'
import { Section } from './Section'

interface BenefitCardProps {
  className?: string
  title: string
  description: string
  link: string
  icon: JSX.Element
}

const BenefitCard = ({
  className,
  title,
  description,
  icon,
  link,
}: BenefitCardProps) => {
  return (
    <Link
      className={twMerge(
        'hover:bg-gray-75 dark:hover:bg-polar-900 flex flex-col justify-between gap-y-8 p-12 transition-colors',
        className,
      )}
      href={link}
    >
      <span>{icon}</span>
      <div className="flex flex-col gap-y-2">
        <h3 className="text-xl">{title}</h3>
        <p className="dark:text-polar-200 text-gray-500">{description}</p>
      </div>
    </Link>
  )
}

export const Benefits = () => {
  return (
    <Section className="gap-y-24">
      <div className="flex flex-col items-center gap-y-4">
        <h1 className="text-center text-4xl">Benefits</h1>
        <p className="dark:text-polar-200 text-xl text-gray-500">
          Give supporters access to exclusive content - Polar will automate it.
        </p>
      </div>
      <div className="grid grid-cols-1 overflow-hidden rounded-3xl border md:grid-cols-3">
        <BenefitCard
          className="border-b md:border-r"
          icon={<GitHubIcon width={30} height={30} />}
          title="Private GitHub Repositories"
          description="Grant access based on Subscription status - early access, sponsorware, courses & so much more."
          link="#"
        />
        <BenefitCard
          className="border-b md:border-r"
          icon={<DiscordIcon size={30} />}
          title="Automated Discord Roles"
          description="Give your supporters access to exclusive Discord roles based on how much they support with each month."
          link="#"
        />
        <BenefitCard
          className="border-b"
          icon={
            <FileDownloadOutlined className="text-4xl" fontSize="inherit" />
          }
          title="File Downloads"
          description="Want to sell digital goods? With file downloads, you can grant supporters access as long as they subscribe."
          link="#"
        />
        <BenefitCard
          className="border-b md:border-b-0 md:border-r"
          icon={<StickyNote2Outlined className="text-4xl" fontSize="inherit" />}
          title="Premium & Early Newsletters"
          description="Offer your paid subscribers early sneak peaks & educational content."
          link="#"
        />
        <BenefitCard
          className="border-b md:border-b-0 md:border-r"
          icon={<WebOutlined className="text-4xl" fontSize="inherit" />}
          title="Sponsor Promotion"
          description="Logo promotions on README, sites & newsletters. Polar will automate it."
          link="#"
        />
        <BenefitCard
          icon={<TuneOutlined className="text-4xl" fontSize="inherit" />}
          title="Custom Benefit"
          description="Setup your very own custom benefit - and share private notes such as email addresses, links & more."
          link="#"
        />
      </div>
    </Section>
  )
}
