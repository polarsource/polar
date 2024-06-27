import { FeatureSection } from '@/components/Landing/FeatureSection'
import { PageContent } from '@/components/Landing/LandingPage'
import { Section } from '@/components/Landing/Section'
import { Separator } from 'polarkit/components/ui/separator'

const PAGE_TITLE = 'Benefits'
const PAGE_DESCRIPTION = 'Offer exclusive benefits to your paying supporters'

const steps = [
  {
    title: 'Create Benefits',
    description: 'Setup exclusive benefits for your paying supporters.',
  },
  {
    title: 'Sell Access to Benefits',
    description:
      'Sell access to your benefits with one-time purchasable products or subscriptions.',
  },
  {
    title: 'Automated Access Control',
    description:
      'Benefit access is automatically granted upon purchase, and revoked when a subscription ends.',
  },
]

export default function Page() {
  return (
    <>
      <Section className="relative flex flex-col gap-16 md:gap-32 md:py-24">
        <div className="relative flex flex-col items-center gap-y-8 text-center">
          <h1 className="text-4xl md:text-5xl md:leading-snug">{PAGE_TITLE}</h1>
          <p className="text-lg md:text-xl md:leading-normal">
            {PAGE_DESCRIPTION}
          </p>
        </div>
        <div className="dark:border-polar-700 flex flex-col divide-y overflow-hidden rounded-3xl border md:flex-row md:divide-x md:divide-y-0">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="hover:bg-gray-75 dark:hover:bg-polar-900 group relative flex flex-col transition-colors md:w-1/3"
            >
              <div className="flex h-full w-full flex-col gap-y-6 rounded-none border-none p-10">
                <h3 className="text-xl text-blue-500">0{index + 1}</h3>
                <div className="flex h-full flex-col gap-y-2 leading-relaxed">
                  <h3 className="text-xl">{step.title}</h3>
                  <p className="dark:text-polar-200 text-gray-500">
                    {step.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <FeatureSection
        wrapperClassName="bg-gray-50 dark:bg-polar-900"
        title="Automated Discord Invites"
        description="Offer exclusive access to Support channels"
        media={{
          dark: 'https://7vk6rcnylug0u6hg.public.blob.vercel-storage.com/image-by9QCxX624eWh8Z2G3NjmUD7QVuard.png',
          light:
            'https://7vk6rcnylug0u6hg.public.blob.vercel-storage.com/image-by9QCxX624eWh8Z2G3NjmUD7QVuard.png',
        }}
        features={[
          'Configure Discord server roles',
          'Invite & assign roles to paying supporters',
          'Automatically revoked access when a subscription ends',
        ]}
      />

      <FeatureSection
        title="Access to private repositories"
        description="Invite supporters to your private repositories"
        media={{
          dark: 'https://7vk6rcnylug0u6hg.public.blob.vercel-storage.com/GitHub%20Repo-N4Yx3M434zkSTK3qQHubUyVNwXDohp.png',
          light:
            'https://7vk6rcnylug0u6hg.public.blob.vercel-storage.com/GitHub%20Repo-N4Yx3M434zkSTK3qQHubUyVNwXDohp.png',
        }}
        features={[
          'GitHub repositories supported',
          'Invite paying supporters to any private repository',
          'Automatically revoked access when a subscription ends',
        ]}
        direction="row-reverse"
      />

      <FeatureSection
        wrapperClassName="bg-gray-50 dark:bg-polar-900"
        title="File Downloads"
        description="Sell any digital product with ease"
        media={{
          dark: 'https://7vk6rcnylug0u6hg.public.blob.vercel-storage.com/image-AjGIfjtZ6O3iRIOOPSVKIt4tmSguK6.png',
          light:
            'https://7vk6rcnylug0u6hg.public.blob.vercel-storage.com/image-AjGIfjtZ6O3iRIOOPSVKIt4tmSguK6.png',
        }}
        features={[
          'Sell e-books, courses, software, & more',
          'Backers get access to download links',
          '10GB file size limit',
          'SHA256 checksums for secure downloads',
          'Automatically revoked access when a subscription ends',
        ]}
      />

      <FeatureSection
        title="Sponsor Advertiesements"
        description="Sell ad-spots on your GitHub README"
        media={{
          dark: 'https://7vk6rcnylug0u6hg.public.blob.vercel-storage.com/image-mMJ567skrMbikmkRmQvogyO16TsgCt.png',
          light:
            'https://7vk6rcnylug0u6hg.public.blob.vercel-storage.com/image-mMJ567skrMbikmkRmQvogyO16TsgCt.png',
        }}
        features={[
          'Automate README.md logotypes & offer newsletter ad-spots',
          'Automatically revoked access when a subscription ends',
        ]}
        direction="row-reverse"
      />

      <FeatureSection
        wrapperClassName="bg-gray-50 dark:bg-polar-900"
        title="Premium & Early Newsletter"
        description='Exclusive access to "Supporter-only" newsletters'
        media={{
          dark: 'https://7vk6rcnylug0u6hg.public.blob.vercel-storage.com/access-FhW12LQg0jaVPu1JadApUeESY0mA1S.jpg',
          light:
            'https://7vk6rcnylug0u6hg.public.blob.vercel-storage.com/access-FhW12LQg0jaVPu1JadApUeESY0mA1S.jpg',
        }}
        features={[
          'Grant access to premium newsletters for your most devoted supporters',
          'Enhance public newsletters with early-access for paying supporters',
          'Automatically revoked access when a subscription ends',
        ]}
      />

      <FeatureSection
        title="Custom Benefits"
        description="Want to offer something special? Build your own custom benefits."
        media={{
          dark: 'https://7vk6rcnylug0u6hg.public.blob.vercel-storage.com/Logo_Exp_1-e9g1wHBfcSnQwY6exCHtF4dRAt2RzO.jpg',
          light:
            'https://7vk6rcnylug0u6hg.public.blob.vercel-storage.com/Logo_Exp_1-e9g1wHBfcSnQwY6exCHtF4dRAt2RzO.jpg',
        }}
        features={[
          'Share secret notes, e.g Cal.com link to book consultation.',
          'Configure VAT applicability',
        ]}
        direction="row-reverse"
      />

      <Separator />

      <PageContent />
    </>
  )
}

export const metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  openGraph: {
    description: PAGE_DESCRIPTION,
  },
  twitter: {
    description: PAGE_DESCRIPTION,
  },
}
