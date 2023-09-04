import { Organization, Repository } from 'polarkit/api/client'
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
    <div className="flex flex-col-reverse items-center justify-between gap-4 md:flex-row">
      <Navigation
        organization={organization}
        repositories={repositories}
        repository={repository}
      ></Navigation>

      <a href="/">
        <LogoType />
      </a>
    </div>
  )
}

export default Header
