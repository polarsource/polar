import Topbar, { LogoPosition } from '../Shared/Topbar'
import EmptyLayout from './EmptyLayout'

const TopbarLayout = ({
  children,
  logoPosition,
}: {
  children: React.ReactElement
  logoPosition?: LogoPosition
}) => {
  return (
    <EmptyLayout>
      <>
        <Topbar logoPosition={logoPosition} />
        {children}
      </>
    </EmptyLayout>
  )
}

export default TopbarLayout
