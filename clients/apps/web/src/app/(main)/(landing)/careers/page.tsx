import { Metadata } from 'next'
import { JobSection } from './JobSection'

export const metadata: Metadata = {
  title: 'Careers',
  description: 'Help us shape the future.',
  keywords: [
    'careers',
    'join',
    'team',
    'polar',
    'open source',
    'jobs',
    'hiring',
    'positions',
  ],
  openGraph: {
    siteName: 'Polar',
    type: 'website',
    images: [
      {
        url: 'https://polar.sh/assets/brand/polar_og.jpg',
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: [
      {
        url: 'https://polar.sh/assets/brand/polar_og.jpg',
        width: 1200,
        height: 630,
        alt: 'Polar',
      },
    ],
  },
}

export default function CareersPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 md:gap-16 md:px-8">
      <h1 className="text-3xl md:text-5xl">Careers</h1>
      <div className="flex flex-col gap-12">
        <JobSection
          title="Operations "
          jobs={[
            {
              role: 'Chief of Staff',
              description:
                'Help us scale from an early-stage startup to scale-up.',
              location: 'Stockholm, Sweden',
              link: 'https://jobs.gem.com/polar/am9icG9zdDp6OvHLVgSUOIC87Ij7TiE9',
            },
          ]}
        />

        <JobSection
          title="Engineering"
          jobs={[
            {
              role: 'Staff Frontend Engineer',
              description:
                'Lead the development of our frontend codebase and how we ship composible billing components for developers',
              location: 'Remote — Europe',
              link: 'https://jobs.gem.com/polar/am9icG9zdDparTigzDB_RewSqH5o5htc',
            },
            {
              role: 'Staff Product Engineer',
              description:
                'Work across our entire stack to ship innovative features to enhance how developers monetize their software.',
              location: 'Remote — Europe',
              link: 'https://jobs.gem.com/polar/am9icG9zdDpgsiQcAqkm5Om5LnR4TJs2',
            },
            {
              role: 'Senior Product Engineer',
              description:
                'Work across our entire stack to ship innovative features to enhance how developers monetize their software.',
              location: 'Remote — Europe',
              link: 'https://jobs.gem.com/polar/am9icG9zdDpzKcc8t-KY2aAP96pbMHP_',
            },
            {
              role: 'Support Engineer',
              description:
                'Help our customers get the most out of Polar. Improve our docs, build internal tooling and automations to scale those efforts.',
              location: 'Remote — Europe',
              link: 'https://jobs.gem.com/polar/am9icG9zdDq-gyYKkPmJozQGu_MfvgJ_',
            },
          ]}
        />
      </div>
    </div>
  )
}
