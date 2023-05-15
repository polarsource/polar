import SettingsCheckbox from './SettingsCheckbox'

export type Settings = {
  email_notification_maintainer_issue_receives_backing?: boolean
  email_notification_maintainer_issue_branch_created?: boolean
  email_notification_maintainer_pull_request_created?: boolean
  email_notification_maintainer_pull_request_merged?: boolean
  email_notification_backed_issue_branch_created?: boolean
  email_notification_backed_issue_pull_request_created?: boolean
  email_notification_backed_issue_pull_request_merged?: boolean
}

const NotificationSettings = ({
  settings,
  orgName,
  onUpdated,
}: {
  settings: Settings
  orgName: string
  onUpdated: (value: Settings) => void
}) => {
  const save = (next: Settings) => {
    const a: Settings = {
      ...settings,
      ...next,
    }
    onUpdated(a)
  }

  if (!settings) {
    return <></>
  }

  return (
    <>
      <SettingsCheckbox
        id="email-backing"
        title={`Issue in ${orgName} receives backing`}
        isChecked={
          !!settings.email_notification_maintainer_issue_receives_backing
        }
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          save({
            email_notification_maintainer_issue_receives_backing:
              e.target.checked,
          })
        }}
      />

      <SettingsCheckbox
        id="email_notification_maintainer_issue_branch_created"
        title={`Branch created for issue with backing in ${orgName}`}
        isChecked={
          !!settings.email_notification_maintainer_issue_branch_created
        }
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          save({
            email_notification_maintainer_issue_branch_created:
              e.target.checked,
          })
        }}
      />
      <SettingsCheckbox
        id="email_notification_maintainer_pull_request_created"
        title={`Pull request created for issue with backing in ${orgName}`}
        isChecked={
          !!settings.email_notification_maintainer_pull_request_created
        }
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          save({
            email_notification_maintainer_pull_request_created:
              e.target.checked,
          })
        }}
      />
      <SettingsCheckbox
        id="email_notification_maintainer_pull_request_merged"
        title={`Pull request merged for issue with backing in ${orgName}`}
        isChecked={!!settings.email_notification_maintainer_pull_request_merged}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          save({
            email_notification_maintainer_pull_request_merged: e.target.checked,
          })
        }}
      />

      <SettingsCheckbox
        id="email_notification_backed_issue_branch_created"
        title="Branch created for issue that you've backed"
        isChecked={!!settings.email_notification_backed_issue_branch_created}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          save({
            email_notification_backed_issue_branch_created: e.target.checked,
          })
        }}
      />
      <SettingsCheckbox
        id="email_notification_backed_issue_pull_request_created"
        title="Pull request created for issue that you've backed"
        isChecked={
          !!settings.email_notification_backed_issue_pull_request_created
        }
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          save({
            email_notification_backed_issue_pull_request_created:
              e.target.checked,
          })
        }}
      />
      <SettingsCheckbox
        id="email_notification_backed_issue_pull_request_merged"
        title="Pull request merged for issue that you've backed"
        isChecked={
          !!settings.email_notification_backed_issue_pull_request_merged
        }
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          save({
            email_notification_backed_issue_pull_request_merged:
              e.target.checked,
          })
        }}
      />
    </>
  )
}

export default NotificationSettings
