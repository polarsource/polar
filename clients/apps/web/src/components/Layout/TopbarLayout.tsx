import Topbar, { LogoPosition } from '../Shared/Topbar'
import EmptyLayout from './EmptyLayout'

const TopbarLayout = ({
  children,
  logoPosition,
  isFixed,
  hideProfile,
}: {
  children: React.ReactElement
  logoPosition?: LogoPosition
  isFixed?: boolean
  hideProfile?: boolean
}) => {
  return (
    <EmptyLayout>
      <>
        <Topbar
          logoPosition={logoPosition}
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
