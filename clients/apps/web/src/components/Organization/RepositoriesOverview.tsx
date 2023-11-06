import { Organization, Repository } from '@polar-sh/sdk'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
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
      <div className="mt-6 flex w-full flex-col gap-y-12">
        <div className="grid w-full grid-cols-2 gap-6">
          {repositoriesAsCards.map((repository) => (
            <Link
              key={repository.id}
              href={`/${organization.name}/${repository.name}`}
            >
              <Card>
                <CardHeader>
                  <h3 className="text-lg">{repository.name}</h3>
                </CardHeader>
                <CardContent>
                  <p>{repository.description}</p>
                </CardContent>
                <CardFooter>
                  {repository.license} issues · {repository.stars}{' '}
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
        <div className="flex flex-col gap-y-4">
          {repositoriesAsList.map((repository) => (
            <Link
              key={repository.id}
              href={`/${organization.name}/${repository.name}`}
            >
              <div className="flex flex-col p-4">
                <h3>{repository.name}</h3>
                <p>{repository.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
