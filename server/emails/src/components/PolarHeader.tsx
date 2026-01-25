import { Column, Img, Link, Row, Section } from '@react-email/components'

interface HeaderProps {}

const Header = () => (
  <Section className="pt-[10px]">
    <Row>
      <Column className="w-[80%]">
        <Img
          alt="Spaire Logo"
          height="34"
          src="https://spaire-production-files-public.s3.us-east-1.amazonaws.com/spaire-green-combination.png"
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
                src="https://spaire-production-files-public.s3.us-east-1.amazonaws.com/67115fa14af6293adb962bfd_linkedin+(1).svg"
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
                src="https://spaire-production-files-public.s3.us-east-1.amazonaws.com/67115ff4288cd64e56e2eb71_Instagram-1.svg"
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

