import { type OrganizationRead, type RepositoryRead } from '../../api/client'
import { GrayCard } from '../ui/Cards'

const RepositoryCard = ({
  organization,
  repository,
}: {
  organization: OrganizationRead
  repository: RepositoryRead
}) => {
  return (
    <>
      <GrayCard className="mt-6 py-6 px-8 text-center" padding={false}>
        <div className="flex flex-row justify-center space-x-2">
          <img
            className="h-6 w-6 rounded-full"
            src={organization.avatar_url}
            alt=""
          />
          <h2 className="text-lg font-normal text-gray-900">
            {repository.name}
          </h2>
        </div>
        <p className="my-3 text-sm font-normal text-gray-500">
          {repository.description}
        </p>
        <div className="flex flex-row justify-center space-x-4">
          <p className="text-sm text-gray-600">{repository.stars} stars</p>
          <p className="text-sm text-red-600">License (missing)</p>
          <p className="text-sm text-red-600">URL (missing)</p>
        </div>
      </GrayCard>
    </>
  )
}
export default RepositoryCard
