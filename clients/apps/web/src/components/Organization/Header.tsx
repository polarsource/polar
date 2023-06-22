import Link from 'next/link'
import {
  OrganizationPublicRead,
  RepositoryPublicRead,
} from 'polarkit/api/client'
import { LogoType } from 'polarkit/components/brand'
import Navigation from './Navigation'

const Header = ({
  organization,
  repositories,
  repository,
}: {
  organization: OrganizationPublicRead
  repositories: RepositoryPublicRead[]
  repository?: RepositoryPublicRead
}) => {
  return (
    <div className="flex flex-col-reverse items-center justify-between gap-4 md:flex-row">
      <Navigation
        organization={organization}
        repositories={repositories}
        repository={repository}
      ></Navigation>

      <Link href="/">
        <LogoType />
      </Link>
    </div>
  )
}

export default Header
