import Gatekeeper from 'components/Dashboard/Gatekeeper/Gatekeeper'
import SynchronizeRepositories from 'components/Dashboard/Onboarding/SynchronizeRepositories'
import { BadgeSettings } from 'components/Settings/BadgeSettings'
import Box from 'components/Settings/Box'
import Spinner from 'components/Shared/Spinner'
import Topbar from 'components/Shared/Topbar'
import { motion } from 'framer-motion'
import { NextLayoutComponentType } from 'next'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { api } from 'polarkit/api'
import { type OrganizationRead } from 'polarkit/api/client'
import { ReactElement, useState } from 'react'
import { useCurrentOrgAndRepoFromURL } from '../../../../hooks'

import OnboardingControls from 'components/Dashboard/Onboarding/OnboardingControls'

const Page: NextLayoutComponentType = () => {
  const [showControls, setShowControls] = useState<boolean>(false)
  const [showSetup, setShowSetup] = useState<boolean>(false)
  const [badgeAddOldIssues, setBadgeAddOldIssues] = useState<boolean>(true)
  const [badgeShowRaised, setBadgeShowRaised] = useState<boolean>(true)
  const { org } = useCurrentOrgAndRepoFromURL()
  const router = useRouter()

  const redirectToOrg = () => {
    router.push(`/dashboard/${org.name}`)
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
        redirectToOrg()
      })
  }

  if (!org) {
    return <></>
  }

  return (
    <>
      <Head>
        <title>Polar {org.name}</title>
      </Head>
      <div className="flex h-screen">
        <div className="m-auto w-[700px]">
          {showSetup && (
            <>
              <h1 className="flex-column mb-11 flex items-center justify-center text-center text-xl font-normal text-gray-500">
                Add Polar to your open source issues
              </h1>

              <motion.div
                variants={{
                  hidden: {
                    opacity: 0,
                    scale: 0.5,
                  },
                  show: {
                    opacity: 1,
                    scale: [1, 1.1, 1],
                  },
                }}
                initial="hidden"
                animate="show"
                className="mb-11"
              >
                <Box>
                  <h1>Polar will inject this badge into new issues:</h1>
                  <BadgeSettings
                    badgeAddOldIssues={badgeAddOldIssues}
                    badgeShowRaised={badgeShowRaised}
                    setBadgeAddOldIssues={setBadgeAddOldIssues}
                    setBadgeShowRaised={setBadgeShowRaised}
                  />
                </Box>
              </motion.div>
            </>
          )}

          {!showSetup && (
            <h1 className="flex-column mb-11 flex items-center justify-center text-center text-xl font-normal text-gray-500">
              Connecting repositories
              <span className="ml-4">
                <Spinner />
              </span>
            </h1>
          )}

          <SynchronizeRepositories
            org={org}
            showSetup={showSetup}
            setShowControls={setShowControls}
          />

          {showControls && (
            <motion.div
              variants={{
                hidden: {
                  opacity: 0,
                  scale: 1,
                },
                show: {
                  opacity: 1,
                  scale: [1, 1.1, 1],
                },
              }}
              initial="hidden"
              animate="show"
            >
              <OnboardingControls
                onClickContinue={() => {
                  if (!showSetup) {
                    setShowSetup(true)
                  } else {
                    onClickContinue()
                  }
                }}
                skippable={showSetup}
                onClickSkip={redirectToOrg}
              />
            </motion.div>
          )}
        </div>
      </div>
    </>
  )
}

Page.getLayout = (page: ReactElement) => {
  return (
    <>
      <Topbar hideProfile={true} />
      <Gatekeeper>{page}</Gatekeeper>
    </>
  )
}

export default Page
