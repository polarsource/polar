import { type OrganizationRead, type RepositoryRead } from 'polarkit/api/client'

const RepositoryCard = ({
  organization,
  repository,
}: {
  organization: OrganizationRead
  repository: RepositoryRead
}) => {
  return (
    <>
      <div className="border-1 mt-6 w-full rounded-xl border py-6 px-8 text-center">
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
      </div>
    </>
  )
}
export default RepositoryCard
