import { UserRead } from '@polar-sh/sdk'
import { ReactNode } from 'react'
import Topbar from '../Shared/Topbar'
import EmptyLayout from './EmptyLayout'

const TopbarLayout = ({
  children,
  hideProfile,
  authenticatedUser,
}: {
  children: ReactNode
  hideProfile?: boolean
  authenticatedUser?: UserRead
}) => {
  return (
    <EmptyLayout>
      <>
        <Topbar
          hideProfile={hideProfile}
          authenticatedUser={authenticatedUser}
        />
        {children}
      </>
    </EmptyLayout>
  )
}

export default TopbarLayout
