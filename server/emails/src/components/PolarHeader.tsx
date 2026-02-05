import { Column, Img, Row, Section } from '@react-email/components'

interface HeaderProps {}

const Header = () => (
  <Section className="pt-[2px]">
    <Row>
      <Column className="w-[80%]">
        <div className="relative -ml-[8px] h-[32px]">
          <Img
            alt="Polar Logo"
            height="48"
            src="https://polar-public-assets.s3.us-east-2.amazonaws.com/emails/polar-logo-black-badge.png"
          />
        </div>
      </Column>
    </Row>
  </Section>
)

export default Header
