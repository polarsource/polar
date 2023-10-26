import { InfoOutlined } from '@mui/icons-material'
import { Button } from 'polarkit/components/ui/atoms'
import { useUser, useUserPreferencesMutation } from 'polarkit/hooks'
import { useEffect, useState } from 'react'
import Box from './Box'
import SettingsCheckbox from './SettingsCheckbox'

export type Settings = {
  email_newsletters_and_changelogs?: boolean
  email_promotions_and_events?: boolean
}

const NotificationSettings = () => {
  const user = useUser()
  const mutation = useUserPreferencesMutation()
  const [settings, setSettings] = useState<Settings>({})

  useEffect(() => {
    if (!user.data) {
      return
    }

    setSettings({
      email_newsletters_and_changelogs:
        user.data?.email_newsletters_and_changelogs,
      email_promotions_and_events: user.data?.email_promotions_and_events,
    })
  }, [user.data])

  const [canSave, setCanSave] = useState(false)

  const onUpdated = (next: Settings) => {
    setSettings({
      ...settings,
      ...next,
    })
    setCanSave(true)
  }

  const save = async (event: React.MouseEvent<HTMLButtonElement>) => {
    await mutation.mutateAsync({ userUpdateSettings: settings })
  }

  if (!user.data) {
    return <></>
  }

  return (
    <NotificationSettingsBox
      settings={settings}
      canSave={canSave}
      onUpdated={onUpdated}
      isSaving={mutation.isPending}
      save={save}
    />
  )
}

export default NotificationSettings

export const NotificationSettingsBox = (props: {
  settings: Settings
  onUpdated: (value: Settings) => void
  save: (event: React.MouseEvent<HTMLButtonElement>) => void
  canSave: boolean
  isSaving: boolean
}) => {
  return (
    <div className="w-full space-y-8">
      <Box>
        <SettingsCheckbox
          id="email-newsletters-and-changelogs"
          title={`Newsletters and changelogs`}
          isChecked={!!props.settings.email_newsletters_and_changelogs}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            props.onUpdated({
              email_newsletters_and_changelogs: e.target.checked,
            })
          }}
        />
        <SettingsCheckbox
          id="email-promotions-and-events"
          title={`Promotions and events`}
          isChecked={!!props.settings.email_promotions_and_events}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            props.onUpdated({
              email_promotions_and_events: e.target.checked,
            })
          }}
        />
        <span className="dark:text-polar-400 inline-flex items-center gap-x-1 space-x-1 text-sm text-gray-500">
          <InfoOutlined className="dark:text-polar-400 h-5 w-5 text-gray-400" />
          <span>
            You&apos;ll always receive emails about pledges and transactions
          </span>
        </span>
      </Box>

      <Button
        fullWidth={false}
        classNames="min-w-[100px]"
        loading={props.isSaving}
        onClick={props.save}
        disabled={!props.canSave}
      >
        <span>Save</span>
      </Button>
    </div>
  )
}
