import Topbar, { LogoPosition } from '../Shared/Topbar'
import EmptyLayout from './EmptyLayout'

const TopbarLayout = ({
  children,
  logoPosition,
  isFixed,
}: {
  children: React.ReactElement
  logoPosition?: LogoPosition
  isFixed?: boolean
}) => {
  return (
    <EmptyLayout>
      <>
        <Topbar
          logoPosition={logoPosition}
          isFixed={isFixed}
          useOrgFromURL={false}
        />
        {children}
      </>
    </EmptyLayout>
  )
}

export default TopbarLayout
