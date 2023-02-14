import Header from 'components/Shared/Header'
import Container from 'components/Shared/Container'
import Sidebar from 'components/Dashboard/Sidebar'
import Navigation from 'components/Dashboard/Navigation'

const Layout = ({ children }) => {
  return (
    <>
      <Header wide={true}>
        <Navigation />
      </Header>

      <Container wide={true} className="mt-4 text-center items-start">
        <Sidebar />

        <div className="grow">{children}</div>
      </Container>
    </>
  )
}

export default Layout
