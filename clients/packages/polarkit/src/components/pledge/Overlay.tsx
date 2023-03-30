import { RepoSelection } from 'polarkit/components'
import { requireAuth, useUserOrganizations } from 'polarkit/hooks'
import { useState } from 'react'

const Overlay = () => {
  return (
    <div className="fixed bottom-0 left-0 right-0 top-0 z-10 flex items-center justify-center bg-black/20">
      <Box />
    </div>
  )
}

const Box = () => {
  const { currentUser } = requireAuth()
  const userOrgQuery = useUserOrganizations(currentUser)

  const [pledgeAs, setPledgeAs] = useState('')

  const onSelectOrg = (selected: string) => {
    setPledgeAs(selected)
  }

  return (
    <div className="h-1/2 w-1/2 rounded-md bg-white p-4">
      <h1 className="font-md text-xl">Add a pledge to NNN #123</h1>
      <div className="flex items-center">
        <span>Pledge as</span>
        <RepoSelection onSelectOrg={onSelectOrg} />
      </div>
    </div>
  )
}

export default Overlay
