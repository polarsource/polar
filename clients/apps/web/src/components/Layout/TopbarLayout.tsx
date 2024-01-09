import { UserRead } from '@polar-sh/sdk'
import { ReactNode } from 'react'
import Topbar, { LogoPosition } from '../Shared/Topbar'
import EmptyLayout from './EmptyLayout'

const TopbarLayout = ({
  children,
  logoPosition,
  isFixed,
  hideProfile,
  authenticatedUser,
}: {
  children: ReactNode
  logoPosition?: LogoPosition
  logoTile?: string
  isFixed?: boolean
  hideProfile?: boolean
  authenticatedUser?: UserRead
}) => {
  return (
    <EmptyLayout>
      <>
        <Topbar
          logo={{
            position: logoPosition,
          }}
          isFixed={isFixed}
          useOrgFromURL={false}
          hideProfile={hideProfile}
          authenticatedUser={authenticatedUser}
        />
        {children}
      </>
    </EmptyLayout>
  )
}

export default TopbarLayout
