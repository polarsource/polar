import { Column, Img, Link, Row, Section, Text } from '@react-email/components'
import type { schemas } from '../types'

const S3_HOST = 'polar-public-files.s3.amazonaws.com'
const CDN_HOST = 'uploads.polar.sh'

const getResizedAvatarUrl = (url: string): string => {
  if (!url.includes(S3_HOST)) return url
  const cdnUrl = url.replace(S3_HOST, CDN_HOST)
  return `${cdnUrl}${cdnUrl.includes('?') ? '&' : '?'}width=64`
}

interface HeaderProps {
  organization: schemas['Organization']
}

const LinkWrapper = ({
  href,
  children,
}: {
  href: string | null
  children: React.ReactNode
}) => {
  if (!href) {
    return <>{children}</>
  }
  return <Link href={href}>{children}</Link>
}

const Header = ({ organization }: HeaderProps) => (
  <LinkWrapper href={organization.website}>
    <Section className="pt-[10px]">
      <Row>
        {organization.avatar_url && (
          <Column className="w-10">
            <Img
              alt={organization.name}
              src={getResizedAvatarUrl(organization.avatar_url)}
              className="size-8 overflow-hidden rounded-full object-cover"
            />
          </Column>
        )}
        <Column>
          <Text className="my-0 text-lg font-bold text-gray-900">
            {organization.name}
          </Text>
        </Column>
      </Row>
    </Section>
  </LinkWrapper>
)

export default Header
