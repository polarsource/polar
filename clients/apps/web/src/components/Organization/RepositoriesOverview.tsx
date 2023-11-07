import { HiveOutlined, Star } from '@mui/icons-material'
import { Organization, Repository } from '@polar-sh/sdk'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  Pill,
} from 'polarkit/components/ui/atoms'
import { useMemo } from 'react'

interface RepositoriesOverviewProps {
  organization: Organization
  repositories: Repository[]
}

export const RepositoriesOverivew = ({
  organization,
  repositories,
}: RepositoriesOverviewProps) => {
  const repositoriesByStars = useMemo(
    () => repositories.sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0)),
    [repositories],
  )

  const repositoriesAsCards = useMemo(
    () => repositoriesByStars.slice(0, 4),
    [repositories],
  )

  const repositoriesAsList = useMemo(
    () => repositoriesByStars.slice(4),
    [repositories],
  )

  return (
    <>
      <h2 className="text-lg">Repositories</h2>
      <div className="mt-6 flex w-full flex-col gap-y-8">
        <div className="relative grid w-full grid-cols-2 justify-stretch gap-6">
          {repositoriesAsCards.map((repository) => (
            <Link
              key={repository.id}
              href={`/${organization.name}/${repository.name}`}
            >
              <Card className="dark:hover:bg-polar-800 flex h-full flex-col rounded-2xl transition-colors duration-100 hover:border-blue-100 hover:bg-blue-50">
                <CardHeader className="flex flex-row justify-between p-6">
                  <div className="flex flex-row items-baseline gap-x-3">
                    <span className="text-[20px] text-blue-500">
                      <HiveOutlined fontSize="inherit" />
                    </span>
                    <h3 className="text-lg">{repository.name}</h3>
                  </div>
                </CardHeader>
                {repository.description && (
                  <CardContent className="dark:text-polar-500 flex grow flex-col flex-wrap px-6 py-0 text-gray-400">
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
                  <span className="dark:text-polar-500 flex flex-row items-center gap-x-1 text-gray-400">
                    <Star fontSize="small" />
                    {repository.stars}
                  </span>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
        {repositoriesAsList.length > 0 && (
          <div className="dark:border-polar-700 dark:divide-polar-700 flex flex-col divide-y divide-gray-200 overflow-hidden rounded-2xl border border-gray-200">
            {repositoriesAsList.map((repository) => (
              <Link
                className="dark:hover:bg-polar-800 transition-colors duration-100 hover:bg-blue-50"
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
    </>
  )
}
