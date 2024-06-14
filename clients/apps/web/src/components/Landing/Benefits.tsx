import {
  FileDownloadOutlined,
  StickyNote2Outlined,
  TuneOutlined,
  VerifiedOutlined,
} from '@mui/icons-material'
import { twMerge } from 'tailwind-merge'
import { DiscordIcon } from '../Benefit/utils'
import GitHubIcon from '../Icons/GitHubIcon'
import { Section } from './Section'

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
        'hover:bg-gray-75 dark:hover:bg-polar-900 dark:bg-polar-950 flex flex-col justify-between gap-y-8 p-8 transition-colors',
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
    <Section id="benefits" className="gap-y-24">
      <div
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage: 'url(/assets/landing/circles.svg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
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
        />
        <BenefitCard
          className="border-b md:border-r"
          icon={<DiscordIcon size={30} />}
          title="Automated Discord Roles"
          description="Give your supporters access to exclusive Discord roles based on how much they support with each month."
        />
        <BenefitCard
          className="border-b"
          icon={
            <FileDownloadOutlined className="text-4xl" fontSize="inherit" />
          }
          title="File Downloads"
          description="Want to sell digital goods? With file downloads, you can grant supporters access as long as they subscribe."
        />
        <BenefitCard
          className="border-b md:border-b-0 md:border-r"
          icon={<StickyNote2Outlined className="text-4xl" fontSize="inherit" />}
          title="Premium & Early Newsletters"
          description="Offer your paid subscribers early sneak peaks & educational content."
        />
        <BenefitCard
          className="border-b md:border-b-0 md:border-r"
          icon={<VerifiedOutlined className="text-4xl" fontSize="inherit" />}
          title="Sponsor Promotion"
          description="Logo promotions on README, sites & newsletters. Polar automates it."
        />
        <BenefitCard
          icon={<TuneOutlined className="text-4xl" fontSize="inherit" />}
          title="Custom Benefit"
          description="Setup your very own custom benefit - and share private notes such as email addresses, links & more."
        />
      </div>
    </Section>
  )
}
