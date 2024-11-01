'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import Spinner from '@/components/Shared/Spinner'
import { useListRepositories } from '@/hooks/queries'
import { Organization } from '@polar-sh/sdk'
import { useSearchParams } from 'next/navigation'
import CopyToClipboardInput from 'polarkit/components/ui/atoms/copytoclipboardinput'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import { Tabs, TabsList, TabsTrigger } from 'polarkit/components/ui/atoms/tabs'
import { ReactElement, useState } from 'react'


interface Embeddable {
  preview: ReactElement
  tag: string
}

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

  const [currentEmbedTab, setCurrentEmbedTab] = useState('Issues')

  const embeds: Record<string, Embeddable> = {
    Issues: {
      preview: <img src={`/embed/fund-our-backlog.svg?${orgRepoParams}`} alt="GitHub Embed of Fundable Backlog" />,
      tag: `<a href="https://polar.sh/${orgSlashRepo}"><img src="https://polar.sh/embed/fund-our-backlog.svg?${orgRepoParams}" /></a>`,
    },
    Shield: {
      preview: <img src={`/embed/seeks-funding-shield.svg?${orgRepoParams}`} alt="GitHub Shield of Fundable Issues" />,
      tag: `<a href="https://polar.sh/${orgSlashRepo}"><img src="https://polar.sh/embed/seeks-funding-shield.svg?${orgRepoParams}" /></a>`,
    },
  }

  const embeddables = Object.keys(embeds)

  return (
    <DashboardBody>
      <div className="flex flex-col gap-y-8">
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
                    {embeddables.map((item) => (
                      <TabsTrigger key={item} value={item} size="small">
                        {item}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>

                <div className="dark:bg-polar-800 dark:border-polar-700 relative min-h-[200px] rounded-2xl border border-gray-200 bg-gray-50 p-12">
                  <div className="relative z-10 flex h-[20px] w-full flex-col items-center justify-around">
                    <Spinner />
                  </div>

                  <div className="dark:bg-polar-800 relative z-20 -mt-[20px] flex w-full justify-center bg-gray-50">
                    {embeds[currentEmbedTab].preview || <></>}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <h3 className="dark:text-polar-200 font-medium text-gray-500">
                  Embed code
                </h3>
                <div className="max-w-[600px]">
                  <CopyToClipboardInput
                    value={embeds[currentEmbedTab].tag || ''}
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
