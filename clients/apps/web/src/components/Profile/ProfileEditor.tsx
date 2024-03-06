import { useState } from 'react'
import { ProfileSectionEditor, Section } from './ProfileSectionEditor'

export const ProfileEditor = () => {
  const [selectedSection, setSelectedSection] = useState<Section>()

  return (
    <div className="flex flex-row">
      <ProfileSectionEditor />
      <div></div>
    </div>
  )
}
