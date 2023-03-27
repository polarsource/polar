import Topbar from '../Shared/Topbar'

const TopbarLayout = ({ children }) => {
  return (
    <>
      <Topbar />
      <div>{children}</div>
    </>
  )
}

export default TopbarLayout
