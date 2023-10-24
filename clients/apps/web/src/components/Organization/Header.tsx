import { Organization, Repository } from '@polar-sh/sdk'
import { LogoType } from 'polarkit/components/brand'
import Navigation from './Navigation'

const Header = ({
  organization,
  repositories,
  repository,
}: {
  organization: Organization
  repositories: Repository[]
  repository?: Repository
}) => {
  return (
    <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
      <a href="/">
        <LogoType />
      </a>

      <Navigation
        organization={organization}
        repositories={repositories}
        repository={repository}
      ></Navigation>
    </div>
  )
}

export default Header
