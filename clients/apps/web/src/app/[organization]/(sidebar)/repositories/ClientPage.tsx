'use client'

import { useHasLinkedExternalOrganizations } from '@/hooks'
import { organizationPageLink } from '@/utils/nav'
import { formatStarsNumber } from '@/utils/stars'
import { useTrafficRecordPageView } from '@/utils/traffic'
import { StarIcon } from '@heroicons/react/24/solid'
import { HiveOutlined } from '@mui/icons-material'
import { Organization, Repository } from '@polar-sh/sdk'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Pill } from 'polarkit/components/ui/atoms'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from 'polarkit/components/ui/atoms/card'
import { List, ListItem } from 'polarkit/components/ui/atoms/list'

interface RepositoriesOverviewProps {
  organization: Organization
  repositories: Repository[]
}

export const ClientPage = ({
  organization,
  repositories,
}: RepositoriesOverviewProps) => {
  useTrafficRecordPageView({ organization })

  const repositoriesByStars = repositories.sort(
    (a, b) => (b.stars ?? 0) - (a.stars ?? 0),
  )
  const repositoriesAsCards = repositoriesByStars.slice(0, 4)
  const repositoriesAsList = repositoriesByStars.slice(4)

  const hasLinkedExternalOrganizations =
    useHasLinkedExternalOrganizations(organization)

  if (!hasLinkedExternalOrganizations) {
    return redirect(organizationPageLink(organization))
  }

  return (
    <>
      {repositories.length > 0 ? (
        <div className="mt-6 flex w-full flex-col gap-y-8">
          <div className="relative flex w-full flex-col justify-stretch gap-6 md:grid md:grid-cols-2">
            {repositoriesAsCards.map((repository) => (
              <Link
                href={organizationPageLink(organization, repository.name)}
                key={repository.id}
              >
                <Card className="dark:hover:bg-polar-900 dark:text-polar-500 dark:hover:text-polar-300 transition-color rounded-4xl flex h-full flex-col text-gray-500 duration-100 hover:bg-gray-50 hover:text-gray-600">
                  <CardHeader className="flex flex-row justify-between p-6">
                    <div className="flex flex-row items-baseline gap-x-3">
                      <span className="text-[20px] text-blue-500">
                        <HiveOutlined fontSize="inherit" />
                      </span>
                      <h3 className="text-lg text-gray-950 dark:text-white">
                        {repository.name}
                      </h3>
                    </div>
                  </CardHeader>
                  {repository.description ? (
                    <CardContent className="flex grow flex-col flex-wrap px-6 py-0 ">
                      <p>{repository.description}</p>
                    </CardContent>
                  ) : (
                    <div className="grow"></div>
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
                    {repository.is_private ? (
                      <Pill className="grow-0 px-3" color="gray">
                        Private
                      </Pill>
                    ) : null}
                    <span className="flex flex-row items-center gap-x-1 text-sm">
                      <StarIcon className="h-4 w-4" />
                      <span className="pt-.5">
                        {formatStarsNumber(repository.stars ?? 0)}
                      </span>
                    </span>
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>
          {repositoriesAsList.length > 0 && (
            <List>
              {repositoriesAsList.map((repository) => (
                <Link
                  key={repository.id}
                  href={organizationPageLink(organization, repository.name)}
                >
                  <ListItem>
                    <div className="flex flex-col gap-y-2">
                      <span className="flex flex-row gap-x-4">
                        <h3 className="dark:text-white">{repository.name}</h3>
                        {repository.license ? (
                          <Pill className="grow-0 px-3" color="blue">
                            {repository.license}
                          </Pill>
                        ) : (
                          <Pill className="grow-0 px-3" color="gray">
                            Unlicensed
                          </Pill>
                        )}
                        {repository.is_private ? (
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
                  </ListItem>
                </Link>
              ))}
            </List>
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
