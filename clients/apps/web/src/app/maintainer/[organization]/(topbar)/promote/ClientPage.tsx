'use client'

import { GitHubAppInstallationUpsell } from '@/components/Dashboard/Upsell'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import DashboardTopbar from '@/components/Navigation/DashboardTopbar'
import { RepoPickerHeader } from '@/components/Organization/RepoPickerHeader'
import { useCurrentOrgAndRepoFromURL } from '@/hooks/org'
import { Organization } from '@polar-sh/sdk'
import CopyToClipboardInput from 'polarkit/components/ui/atoms/copytoclipboardinput'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import { Tabs, TabsList, TabsTrigger } from 'polarkit/components/ui/atoms/tabs'
import { useListRepositories } from 'polarkit/hooks'
import { ReactElement, useState } from 'react'

export default function ClientPage({organization}: {organization: Organization}) {
  const { repo: currentRepo } = useCurrentOrgAndRepoFromURL()

  const orgSlashRepo = currentRepo
    ? `${organization.name}/${currentRepo.name}`
    : `${organization.name}`

  const orgRepoParams = currentRepo
    ? `org=${organization.name}&repo=${currentRepo.name}`
    : `org=${organization.name}`

  const fundingYAML = `polar: ${organization.name}`

  // Get all repositories
  const listRepositoriesQuery = useListRepositories()
  const allRepositories = listRepositoriesQuery?.data?.items

  // Filter repos by current org
  const allOrgRepositories =
    allRepositories?.filter((r) => r?.organization?.id === organization.id) || []

  const [currentEmbedTab, setCurrentEmbedTab] = useState('Tiers')

  const previews: Record<string, ReactElement> = {
    Tiers: (
      <picture>
        <source
          media="(prefers-color-scheme: dark)"
          srcSet={`/embed/tiers.svg?org=${organization.name}&darkmode`}
        />
        <img
          alt="Subscription Tiers on Polar"
          src={`/embed/tiers.svg?org=${organization.name}`}
        />
      </picture>
    ),
    Posts: (
      <picture>
        <source
          media="(prefers-color-scheme: dark)"
          srcSet={`/embed/posts.svg?org=${organization.name}&darkmode`}
        />
        <img alt="Posts on Polar" src={`/embed/posts.svg?org=${organization.name}`} />
      </picture>
    ),
    Subscribe: (
      <picture>
        <source
          media="(prefers-color-scheme: dark)"
          srcSet={`/embed/subscribe.svg?org=${organization.name}&label=Subscribe&darkmode`}
        />
        <img
          alt="Subscribe on Polar"
          src={`/embed/subscribe.svg?org=${organization.name}&label=Subscribe`}
        />
      </picture>
    ),
    Issues: <img src={`/embed/fund-our-backlog.svg?${orgRepoParams}`} />,
    Shield: <img src={`/embed/seeks-funding-shield.svg?${orgRepoParams}`} />,
  }

  const embedCodes: Record<string, string> = {
    Tiers: `<a href="https://polar.sh/${organization.name}/subscriptions"><picture><source media="(prefers-color-scheme: dark)" srcset="https://polar.sh/embed/tiers.svg?org=${organization.name}&darkmode"><img alt="Subscription Tiers on Polar" src="https://polar.sh/embed/tiers.svg?org=${organization.name}"></picture></a>`,
    Posts: `<a href="https://polar.sh/${organization.name}/posts"><picture><source media="(prefers-color-scheme: dark)" srcset="https://polar.sh/embed/posts.svg?org=${organization.name}&darkmode"><img alt="Posts on Polar" src="https://polar.sh/embed/posts.svg?org=${organization.name}"></picture></a>`,
    Subscribe: `<a href="https://polar.sh/${orgSlashRepo}"><picture><source media="(prefers-color-scheme: dark)" srcset="https://polar.sh/embed/subscribe.svg?org=${organization.name}&label=Subscribe&darkmode"><img alt="Subscribe on Polar" src="https://polar.sh/embed/subscribe.svg?org=${organization.name}&label=Subscribe"></picture></a>`,
    Issues: `<a href="https://polar.sh/${orgSlashRepo}"><img src="https://polar.sh/embed/fund-our-backlog.svg?${orgRepoParams}" /></a>`,
    Shield: `<a href="https://polar.sh/${orgSlashRepo}"><img src="https://polar.sh/embed/seeks-funding-shield.svg?${orgRepoParams}" /></a>`,
  }

  return (
    <>
      <DashboardTopbar isFixed useOrgFromURL>
        <RepoPickerHeader
          currentRepository={currentRepo}
          repositories={allOrgRepositories}
        />
      </DashboardTopbar>
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
                <CopyToClipboardInput id="github-funding" value={fundingYAML} />
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
                      {['Tiers', 'Posts', 'Subscribe', 'Issues', 'Shield'].map(
                        (item) => (
                          <TabsTrigger key={item} value={item} size="small">
                            {item}
                          </TabsTrigger>
                        ),
                      )}
                    </TabsList>
                  </div>

                  <div className="dark:bg-polar-800 dark:border-polar-700 flex w-full justify-center rounded-2xl border border-gray-200 bg-gray-50 p-12">
                    {previews[currentEmbedTab] || <></>}
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <h3 className="dark:text-polar-200 font-medium text-gray-500">
                    Embed code
                  </h3>
                  <div className="max-w-[600px]">
                    <CopyToClipboardInput
                      id="embed-svg"
                      value={embedCodes[currentEmbedTab] || ''}
                    />
                  </div>
                </div>
              </div>
            </Tabs>
          </ShadowBox>
        </div>
      </DashboardBody>
    </>
  )
}
