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
      <div className="border-1 mt-4 rounded-xl border py-14 px-8 text-center">
        <div className="flex flex-row justify-center space-x-4">
          <img
            className="h-8 w-8 rounded-full"
            src={organization.avatar_url}
            alt=""
          />
          <h2 className="text-lg font-normal text-gray-900">
            {repository.name}
          </h2>
        </div>
        <p className="my-6 text-gray-500">{repository.description}</p>
        <div className="flex flex-row justify-center space-x-4">
          <p>Stars: {repository.stars}</p>
          <p className="text-red-600">License (missing)</p>
          <p className="text-red-600">URL (missing)</p>
        </div>
      </div>
    </>
  )
}
export default RepositoryCard
