import { Column, Img, Link, Row, Section, Text } from '@react-email/components'
import type { schemas } from '../types'

const S3_TO_CDN: Record<string, string> = {
  'polar-public-files.s3.amazonaws.com': 'uploads.polar.sh',
  'polar-public-sandbox-files.s3.amazonaws.com': 'sandbox-uploads.polar.sh',
}

const getResizedAvatarUrl = (url: string): string => {
  for (const [s3Host, cdnHost] of Object.entries(S3_TO_CDN)) {
    if (url.includes(s3Host)) {
      const cdnUrl = url.replace(s3Host, cdnHost)
      return `${cdnUrl}${cdnUrl.includes('?') ? '&' : '?'}width=64`
    }
  }
  return url
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
