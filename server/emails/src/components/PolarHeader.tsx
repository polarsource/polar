import { Column, Img, Link, Row, Section } from '@react-email/components'

interface HeaderProps {}

const Header = () => (
  <Section className="pt-[10px]">
    <Row>
      <Column className="w-[80%]">
        <Img
          alt="Spaire Logo"
          height="34"
          src="https://spaire-production-files-public.s3.us-east-1.amazonaws.com/spaire-blue-logo.png"
        />
      </Column>
      <Column align="right">
        <Row align="right">
          <Column>
            <Link href="https://www.linkedin.com/company/spaire">
              <Img
                alt="LinkedIn"
                className="mx-[4px]"
                height="36"
                src="https://spaire-production-files-public.s3.us-east-1.amazonaws.com/linkedinlogo.png"
                width="36"
              />
            </Link>
          </Column>
          <Column>
            <Link href="https://discord.gg/Pnhfz3UTh">
              <Img
                alt="Discord"
                className="mx-[4px]"
                height="36"
                src="https://spaire-production-files-public.s3.us-east-1.amazonaws.com/instagram-logo.png"
                width="36"
              />
            </Link>
          </Column>
        </Row>
      </Column>
    </Row>
  </Section>
)

export default Header

