import FakePullRequest from './FakePullRequest'
import SettingsCheckbox from './SettingsCheckbox'

export const BadgeSettings = ({
  badgeShowRaised,
  badgeAddOldIssues,
  setBadgeAddOldIssues,
  setBadgeShowRaised,
}: {
  badgeShowRaised: boolean
  badgeAddOldIssues: boolean
  setBadgeAddOldIssues: (value: boolean) => void
  setBadgeShowRaised: (value: boolean) => void
}) => (
  <>
    <FakePullRequest showAmount={badgeShowRaised} />
    <SettingsCheckbox
      id="add-old-issues"
      title="Add badge to old issues as well"
      description="Could impact sorting on GitHub"
      isChecked={badgeAddOldIssues}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        setBadgeAddOldIssues(e.target.checked)
      }}
    />
    <SettingsCheckbox
      id="show-raised"
      title="Show amount raised"
      isChecked={badgeShowRaised}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        setBadgeShowRaised(e.target.checked)
      }}
    />
  </>
)
