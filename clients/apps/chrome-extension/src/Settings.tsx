import { useChromeStorageLocal } from 'use-chrome-storage'
import ExtensionLink from './ExtensionLink'

export const Settings = () => {
  const [value, setValue, isPersistent, error, isInitialStateResolved] =
    useChromeStorageLocal('token')

  if (isInitialStateResolved && value) {
    return <div>Polar</div>
  } else {
    return (
      <ExtensionLink href="http://127.0.0.1:3000/settings/extension">
        Authorize
      </ExtensionLink>
    )
  }
}
