'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import Spinner from '@/components/Shared/Spinner'
import { useListRepositories } from '@/hooks/queries'
import { Skeleton } from '@mui/material'
import { Organization } from '@polar-sh/sdk'
import { useSearchParams } from 'next/navigation'
import CopyToClipboardInput from 'polarkit/components/ui/atoms/copytoclipboardinput'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import { Tabs, TabsList, TabsTrigger } from 'polarkit/components/ui/atoms/tabs'
import { ReactElement, useState } from 'react'

export default function ClientPage({
  organization,
}: {
  organization: Organization
}) {
  const searchParams = useSearchParams()
  const repoSlug = searchParams.get('repo')
  const repositories = useListRepositories(
    {
      organizationId: organization.id,
      name: repoSlug ?? '',
      limit: 1,
    },
    !!repoSlug,
  )
  const currentRepo = repositories.data?.items[0]

  const orgSlashRepo = currentRepo
    ? `${organization.slug}/${currentRepo.name}`
    : `${organization.slug}`

  const orgRepoParams = currentRepo
    ? `org=${organization.slug}&repo=${currentRepo.name}`
    : `org=${organization.slug}`

  const fundingYAML = `polar: ${organization.slug}`

  const [currentEmbedTab, setCurrentEmbedTab] = useState('Tiers')

  const previews: Record<string, ReactElement> = {
    Tiers: (
      <picture>
        <source
          media="(prefers-color-scheme: dark)"
          srcSet={`/embed/tiers.svg?org=${organization.slug}&darkmode`}
        />
        <img
          alt="Subscription Tiers on Polar"
          src={`/embed/tiers.svg?org=${organization.slug}`}
        />
      </picture>
    ),
    Subscribe: (
      <picture>
        <source
          media="(prefers-color-scheme: dark)"
          srcSet={`/embed/subscribe.svg?org=${organization.slug}&label=Subscribe&darkmode`}
        />
        <img
          alt="Subscribe on Polar"
          src={`/embed/subscribe.svg?org=${organization.slug}&label=Subscribe`}
        />
      </picture>
    ),
    Issues: <img src={`/embed/fund-our-backlog.svg?${orgRepoParams}`} />,
    Shield: <img src={`/embed/seeks-funding-shield.svg?${orgRepoParams}`} />,
  }

  const embedCodes: Record<string, string> = {
    Tiers: `<a href="https://polar.sh/${organization.slug}"><picture><source media="(prefers-color-scheme: dark)" srcset="https://polar.sh/embed/tiers.svg?org=${organization.slug}&darkmode"><img alt="Subscription Tiers on Polar" src="https://polar.sh/embed/tiers.svg?org=${organization.slug}"></picture></a>`,
    Subscribe: `<a href="https://polar.sh/${orgSlashRepo}"><picture><source media="(prefers-color-scheme: dark)" srcset="https://polar.sh/embed/subscribe.svg?org=${organization.slug}&label=Subscribe&darkmode"><img alt="Subscribe on Polar" src="https://polar.sh/embed/subscribe.svg?org=${organization.slug}&label=Subscribe"></picture></a>`,
    Issues: `<a href="https://polar.sh/${orgSlashRepo}"><img src="https://polar.sh/embed/fund-our-backlog.svg?${orgRepoParams}" /></a>`,
    Shield: `<a href="https://polar.sh/${orgSlashRepo}"><img src="https://polar.sh/embed/seeks-funding-shield.svg?${orgRepoParams}" /></a>`,
  }

  return (
    <DashboardBody>
      <div className="flex flex-col gap-y-8">
        <ShadowBox className="flex flex-col gap-y-8">
          <div className="flex flex-col gap-y-2">
            <h2 className="text-lg font-medium">GitHub Sponsors</h2>
            <p className="dark:text-polar-400 text-sm text-gray-500">
              Make sure to link to your public funding page from GitHub&apos;s
              Sponsor section.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <h3 className="dark:text-polar-200 font-medium text-gray-500">
              Link to your Polar funding page
            </h3>
            <div className="max-w-[600px]">
              <CopyToClipboardInput value={fundingYAML} />
            </div>
            <div className="rounded-md border border-blue-100 bg-blue-50 px-4 py-2 text-sm text-blue-500 dark:border-blue-500 dark:bg-blue-700 dark:text-blue-300">
              Follow the instructions{' '}
              <a
                className="font-bold text-blue-500 dark:text-blue-200"
                href="https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/displaying-a-sponsor-button-in-your-repository"
              >
                here
              </a>{' '}
              and paste the above in your FUNDING.yml
            </div>
          </div>
        </ShadowBox>
        <ShadowBox className="flex flex-col gap-y-8">
          <div className="flex flex-col gap-y-2">
            <h2 className="text-lg font-medium">README Embeds</h2>
            <p className="dark:text-polar-400 text-sm text-gray-500">
              Polar Embeds allow you to promote Subscription Tiers & Issues on
              your GitHub README & website
            </p>
          </div>
          <Tabs value={currentEmbedTab} onValueChange={setCurrentEmbedTab}>
            <div className="flex flex-col gap-8">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <TabsList className="bg-transparent dark:bg-transparent">
                    {['Tiers', 'Subscribe', 'Issues', 'Shield'].map((item) => (
                      <TabsTrigger key={item} value={item} size="small">
                        {item}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>

                <div className="dark:bg-polar-800 dark:border-polar-700 relative min-h-[200px] rounded-2xl border border-gray-200 bg-gray-50 p-12">
                  <div className="relative z-10 flex h-[20px] w-full flex-col items-center justify-around">
                    {/* Kind of hacky loading indicator _behind_ the image */}
                    {currentEmbedTab === 'Shield' ? (
                      <Skeleton className="h-[20px] w-[150px]" />
                    ) : (
                      <Spinner />
                    )}
                  </div>

                  <div className="dark:bg-polar-800 relative z-20 -mt-[20px] flex w-full justify-center bg-gray-50">
                    {previews[currentEmbedTab] || <></>}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <h3 className="dark:text-polar-200 font-medium text-gray-500">
                  Embed code
                </h3>
                <div className="max-w-[600px]">
                  <CopyToClipboardInput
                    value={embedCodes[currentEmbedTab] || ''}
                  />
                </div>
              </div>
            </div>
          </Tabs>
        </ShadowBox>
      </div>
    </DashboardBody>
  )
}
