import Topbar from '../Shared/Topbar'
import EmptyLayout from './EmptyLayout'

const TopbarLayout = ({ children }: { children: React.ReactElement }) => {
  return (
    <EmptyLayout>
      <>
        <Topbar />
        {children}
      </>
    </EmptyLayout>
  )
}

export default TopbarLayout
