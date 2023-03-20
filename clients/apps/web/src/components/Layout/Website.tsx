import '@stripe/stripe-js'
import Topbar from '../Shared/Topbar'

const Layout = ({ children }) => {
  return (
    <>
      <Topbar isDashboard={false} />
      <div>{children}</div>
    </>
  )
}

export default Layout
