import '@stripe/stripe-js'
import Topbar from '../Shared/Topbar'

const TopbarLayout = ({ children }) => {
  return (
    <>
      <Topbar isDashboard={false} />
      <div>{children}</div>
    </>
  )
}

export default TopbarLayout
