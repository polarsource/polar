import Header from 'components/Shared/Header'
import Container from 'components/Shared/Container'
import '@stripe/stripe-js'

const Layout = ({ children }) => {
  return (
    <>
      <Header />
      <Container wide={false} className="mt-4 text-center items-start">
        <div className="grow">{children}</div>
      </Container>
    </>
  )
}

export default Layout
