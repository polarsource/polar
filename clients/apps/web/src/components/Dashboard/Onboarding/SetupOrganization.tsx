import { api } from 'polarkit/api'
import { type OrganizationRead } from 'polarkit/api/client'
import { useStore } from 'polarkit/store'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ShowcaseGithubBadge from './ShowcaseGithubBadge'

import OnboardingControls from './OnboardingControls'

export const SetupOrganization = ({ org }: { org: OrganizationRead }) => {
  const [addBadgeToAll, setAddBadgeToAll] = useState(true)
  const [showAmountRaised, setShowAmountRaised] = useState(true)
  const setCurrentOrg = useStore((state) => state.setCurrentOrg)
  const navigate = useNavigate()

  const redirectToFirstRepo = () => {
    const firstRepo = org.repositories[0]
    navigate(`/dashboard/${org.name}/${firstRepo.name}`)
  }

  const onClickContinue = async () => {
    const response = api.organizations
      .updateSettings({
        platform: org.platform,
        organizationName: org.name,
        requestBody: {
          funding_badge_retroactive: addBadgeToAll,
          funding_badge_show_amount: showAmountRaised,
        },
      })
      .then((updatedOrg: OrganizationRead) => {
        setCurrentOrg(updatedOrg)
        redirectToFirstRepo()
      })
  }

  return (
    <>
      <div className="my-5 rounded-lg bg-white py-5 px-6 shadow-md">
        <h4 className="font-medium">
          Polar will inject this badge into new issues:
        </h4>
        <ShowcaseGithubBadge showAmountRaised={showAmountRaised} />
        <fieldset>
          <div className="">
            <div className="relative flex items-start">
              <div className="flex h-6 items-center">
                <input
                  id="allIssues"
                  aria-describedby="comments-description"
                  name="allIssues"
                  type="checkbox"
                  defaultChecked={addBadgeToAll}
                  className="h-4 w-4 rounded border-gray-300 text-purple-500 focus:ring-purple-500"
                  onChange={(e) => {
                    setAddBadgeToAll(!addBadgeToAll)
                  }}
                />
              </div>
              <div className="ml-3 text-sm leading-6">
                <label
                  htmlFor="allIssues"
                  className="font-medium text-gray-900"
                >
                  Add badge to all issues
                </label>
              </div>
            </div>
          </div>
          <div className="my-2">
            <div className="relative flex items-start">
              <div className="flex h-6 items-center">
                <input
                  id="showAmount"
                  aria-describedby="comments-description"
                  name="showAmount"
                  type="checkbox"
                  defaultChecked={showAmountRaised}
                  onChange={(e) => {
                    setShowAmountRaised(!showAmountRaised)
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-purple-500 focus:ring-purple-500"
                />
              </div>
              <div className="ml-3 text-sm leading-6">
                <label
                  htmlFor="showAmount"
                  className="font-medium text-gray-900"
                >
                  Show amount raised
                </label>
              </div>
            </div>
          </div>
        </fieldset>
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
