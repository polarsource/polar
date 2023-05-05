import Topbar from '../Shared/Topbar'
import EmptyLayout from './EmptyLayout'

const TopbarLayout = ({ children }) => {
  return (
    <EmptyLayout>
      <Topbar />
      {children}
    </EmptyLayout>
  )
}

export default TopbarLayout
