import { StarIcon } from '@heroicons/react/24/solid'
import { HiveOutlined } from '@mui/icons-material'
import { Organization, Repository, Visibility } from '@polar-sh/sdk'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  Pill,
} from 'polarkit/components/ui/atoms'

interface RepositoriesOverviewProps {
  organization: Organization
  repositories: Repository[]
}

export const RepositoriesOverivew = ({
  organization,
  repositories,
}: RepositoriesOverviewProps) => {
  const repositoriesByStars = repositories.sort(
    (a, b) => (b.stars ?? 0) - (a.stars ?? 0),
  )
  const repositoriesAsCards = repositoriesByStars.slice(0, 4)
  const repositoriesAsList = repositoriesByStars.slice(4)

  return (
    <>
      {repositories.length > 0 ? (
        <div className="mt-6 flex w-full flex-col gap-y-8">
          <div className="relative flex w-full flex-col justify-stretch gap-6 md:grid md:grid-cols-2">
            {repositoriesAsCards.map((repository) => (
              <Link
                href={`/${organization.name}/${repository.name}`}
                key={repository.id}
              >
                <Card className="dark:hover:bg-polar-800 dark:text-polar-500 dark:hover:text-polar-300 transition-color flex h-full flex-col rounded-2xl text-gray-500 duration-100 hover:bg-gray-50 hover:text-gray-600">
                  <CardHeader className="flex flex-row justify-between p-6">
                    <div className="flex flex-row items-baseline gap-x-3">
                      <span className="text-[20px] text-blue-500">
                        <HiveOutlined fontSize="inherit" />
                      </span>
                      <h3 className="dark:text-polar-50 text-lg text-gray-950">
                        {repository.name}
                      </h3>
                    </div>
                  </CardHeader>
                  {repository.description && (
                    <CardContent className="flex grow flex-col flex-wrap px-6 py-0 ">
                      <p>{repository.description}</p>
                    </CardContent>
                  )}
                  <CardFooter className="flex flex-row items-center gap-x-4 p-6">
                    {repository.license ? (
                      <Pill className="px-3" color="blue">
                        {repository.license}
                      </Pill>
                    ) : (
                      <Pill className="grow-0 px-3" color="gray">
                        Unlicensed
                      </Pill>
                    )}
                    {repository.visibility === Visibility.PRIVATE ? (
                      <Pill className="grow-0 px-3" color="gray">
                        Private
                      </Pill>
                    ) : null}
                    <span className="flex flex-row items-center gap-x-1 text-sm">
                      <StarIcon className="h-4 w-4" />
                      <span className="pt-.5">{repository.stars}</span>
                    </span>
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>
          {repositoriesAsList.length > 0 && (
            <div className="dark:border-polar-700 dark:divide-polar-700 dark:bg-polar-900 flex flex-col divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100 bg-white">
              {repositoriesAsList.map((repository) => (
                <Link
                  className="dark:hover:bg-polar-800 transition-colors duration-100 hover:bg-gray-50"
                  key={repository.id}
                  href={`/${organization.name}/${repository.name}`}
                >
                  <div className="flex flex-col gap-y-2 p-6">
                    <span className="flex flex-row gap-x-4">
                      <h3 className="dark:text-polar-50">{repository.name}</h3>
                      {repository.license ? (
                        <Pill className="grow-0 px-3" color="blue">
                          {repository.license}
                        </Pill>
                      ) : (
                        <Pill className="grow-0 px-3" color="gray">
                          Unlicensed
                        </Pill>
                      )}
                      {repository.visibility === Visibility.PRIVATE ? (
                        <Pill className="grow-0 px-3" color="gray">
                          Private
                        </Pill>
                      ) : null}
                    </span>
                    {repository.description && (
                      <p className="dark:text-polar-500 text-sm text-gray-400">
                        {repository.description}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {repositories.length === 0 ? (
            <div className="dark:text-polar-600 flex flex-col items-center justify-center space-y-6 py-64 text-gray-400">
              <span className="text-6xl">
                <HiveOutlined fontSize="inherit" />
              </span>
              <h2 className="text-lg">No repositories found</h2>
            </div>
          ) : null}
        </>
      )}
    </>
  )
}
