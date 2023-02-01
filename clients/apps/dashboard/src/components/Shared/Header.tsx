import Logo from 'components/Shared/Assets/Logo'
import Container from 'components/Shared/Container'
import Profile from 'components/Shared/Profile'

const Header = ({ wide, children }) => {
  return (
    <>
      <Container wide={wide} className="mt-10 h-10">
        <div className="justify-center w-48">
          <Logo />
        </div>

        <div className="grow">{children}</div>

        <div>
          <Profile />
        </div>
      </Container>
    </>
  )
}

export default Header
