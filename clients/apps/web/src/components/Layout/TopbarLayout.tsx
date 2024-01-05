import { ReactNode } from 'react'
import Topbar, { LogoPosition } from '../Shared/Topbar'
import EmptyLayout from './EmptyLayout'

const TopbarLayout = ({
  children,
  logoPosition,
  isFixed,
  hideProfile,
}: {
  children: ReactNode
  logoPosition?: LogoPosition
  logoTile?: string
  isFixed?: boolean
  hideProfile?: boolean
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
        />
        {children}
      </>
    </EmptyLayout>
  )
}

export default TopbarLayout
