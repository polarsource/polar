'use client'

import { FundOurBacklog } from '@/components/Embed/FundOurBacklog'
import { SeeksFundingShield } from '@/components/Embed/SeeksFundingShield'
import {
  DashboardBody,
  RepoPickerHeader,
} from '@/components/Layout/DashboardLayout'
import DashboardTopbar from '@/components/Shared/DashboardTopbar'
import { useCurrentOrgAndRepoFromURL } from '@/hooks/org'
import {
  CopyToClipboardInput,
  LabeledRadioButton,
  ShadowBox,
} from 'polarkit/components/ui/atoms'
import { useListRepositories, useSearchIssues } from 'polarkit/hooks'
import { ReactElement, useState } from 'react'

export default function ClientPage() {
  const { org, isLoaded, repo: currentRepo } = useCurrentOrgAndRepoFromURL()

  const orgSlashRepo = currentRepo
    ? `${org?.name}/${currentRepo.name}`
    : `${org?.name}`

  const orgRepoParams = currentRepo
    ? `org=${org?.name}&repo=${currentRepo.name}`
    : `org=${org?.name}`

  const fundingYAML = `custom: ["https://polar.sh/${orgSlashRepo}"]`

  const issues = useSearchIssues({
    organizationName: org?.name,
    haveBadge: true,
    repositoryName: currentRepo?.name,
  })

  const [currentEmbedTab, setCurrentEmbedTab] = useState('Issues')

  // Get all repositories
  const listRepositoriesQuery = useListRepositories()
  const allRepositories = listRepositoriesQuery?.data?.items

  // Filter repos by current org & normalize for our select
  const allOrgRepositories =
    allRepositories?.filter((r) => r?.organization?.id === org?.id) || []

  if (!org && isLoaded) {
    return (
      <>
        <div className="mx-auto mt-32 flex max-w-[1100px] flex-col items-center">
          <span>Organization not found</span>
          <span>404 Not Found</span>
        </div>
      </>
    )
  }

  const previews: Record<string, ReactElement> = {
    Issues: (
      <FundOurBacklog
        issues={issues.data?.items || []}
        issueCount={issues.data?.items?.length || 0}
      />
    ),
    Shield: (
      <div className="w-fit">
        <SeeksFundingShield count={issues.data?.items?.length || 0} />
      </div>
    ),
  }

  const embedCodes: Record<string, string> = {
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
        <div className="space-y-4">
          <h2 className="dark:text-polar-100 text-lg text-gray-900">
            GitHub Sponsors
          </h2>
          <p className="dark:text-polar-400 text-sm text-gray-500">
            Make sure to link to your public funding page from GitHub&apos;s
            Sponsor section.
          </p>
          <ShadowBox>
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
                and paste the above in your FUNDING.yaml
              </div>
            </div>
          </ShadowBox>
          <h2 className="dark:text-polar-100 pt-8 text-lg text-gray-900">
            Readme embeds
          </h2>
          <p className="dark:text-polar-400 text-sm text-gray-500">
            Embed the Polar SVG in your README or on your website to showcase
            issues that you&apos;re seeking funding for.
          </p>
          <ShadowBox>
            <div className="flex flex-col gap-8">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="dark:text-polar-200 font-medium text-gray-500">
                    Preview
                  </h3>

                  <LabeledRadioButton
                    values={['Issues', 'Shield']}
                    value={currentEmbedTab}
                    onSelected={setCurrentEmbedTab}
                  />
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
          </ShadowBox>
        </div>
      </DashboardBody>
    </>
  )
}
