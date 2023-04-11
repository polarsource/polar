import { api } from 'polarkit/api'
import { type OrganizationRead } from 'polarkit/api/client'
import { useStore } from 'polarkit/store'
import { useState } from 'react'

import { BadgeSettings } from 'components/Settings/BadgeSettings'
import { Box } from 'components/Settings/Box'
import { useRouter } from 'next/router'
import OnboardingControls from './OnboardingControls'

export const SetupOrganization = ({ org }: { org: OrganizationRead }) => {
  const [badgeAddOldIssues, setBadgeAddOldIssues] = useState(true)
  const [badgeShowRaised, setBadgeShowRaised] = useState(true)
  const setCurrentOrg = useStore((state) => state.setCurrentOrg)
  const router = useRouter()

  const redirectToFirstRepo = () => {
    const firstRepo = org.repositories[0]
    router.push(`/dashboard/${org.name}/${firstRepo.name}`)
  }

  const onClickContinue = async () => {
    const response = api.organizations
      .updateSettings({
        platform: org.platform,
        orgName: org.name,
        requestBody: {
          funding_badge_retroactive: badgeAddOldIssues,
          funding_badge_show_amount: badgeShowRaised,
        },
      })
      .then((updatedOrg: OrganizationRead) => {
        setCurrentOrg(updatedOrg)
        redirectToFirstRepo()
      })
  }

  return (
    <>
      <div className="my-5 py-5 px-6">
        <h4 className="py-5 font-medium ">
          Polar will inject this badge into new issues:
        </h4>
        <Box>
          <BadgeSettings
            badgeAddOldIssues={badgeAddOldIssues}
            badgeShowRaised={badgeShowRaised}
            setBadgeAddOldIssues={setBadgeAddOldIssues}
            setBadgeShowRaised={setBadgeShowRaised}
          />
        </Box>
      </div>
      <OnboardingControls
        onClickContinue={onClickContinue}
        skippable={true}
        onClickSkip={redirectToFirstRepo}
      />
    </>
  )
}

export default SetupOrganization
