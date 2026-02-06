import { Img, Section } from '@react-email/components'

interface HeaderProps {}

const Header = () => (
  <Section>
    <div className="relative h-[48px]">
      <Img
        alt="Spaire Logo"
        height="48"
        src="https://polar-public-assets.s3.us-east-2.amazonaws.com/emails/polar-logo-black-badge.png"
      />
    </div>
  </Section>
)

export default Header
