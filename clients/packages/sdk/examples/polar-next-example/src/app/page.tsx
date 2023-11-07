import {
  Configuration,
  ListFundingSortBy,
  ListResourceIssueFunding,
  Platforms,
  PolarAPI,
} from '@polar-sh/sdk'

const getCentsInDollarString = (
  cents: number,
  showCents = false,
  pretty = false,
): string => {
  const dollars = cents / 100

  const precision = cents % 100 === 0 && !showCents ? 0 : 2

  if (pretty) {
    return dollars.toLocaleString('en-US', {
      maximumFractionDigits: precision,
      minimumFractionDigits: precision,
    })
  }

  return dollars.toFixed(precision)
}

async function getIssues(): Promise<ListResourceIssueFunding> {
  const api = new PolarAPI(new Configuration())

  const issues = await api.funding.search({
    platform: Platforms.GITHUB,
    organizationName: 'polarsource',
    badged: true,
    closed: false,
    sorting: [
      ListFundingSortBy.MOST_FUNDED,
      ListFundingSortBy.MOST_ENGAGEMENT,
      ListFundingSortBy.NEWEST,
    ],
    limit: 20,
  })

  return issues
}

export default async function Home() {
  const issues = await getIssues()

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="flex w-full max-w-5xl flex-col justify-between text-sm">
        <h2 className="mb-4 text-xl font-medium">Issues looking for funding</h2>
        {issues.items?.map(({ issue, funding_goal, total }) => (
          <div
            className="flex flex-row items-center justify-between py-2"
            key={issue.id}
          >
            <a
              target="_blank"
              className="text-md text-blue-500 underline"
              href={`https://github.com/${issue.repository.organization.name}/${issue.repository.name}/issues/${issue.number}`}
              rel="noopener noreferrer"
            >
              {issue.title}
            </a>
            <span className="text-sm">
              ${getCentsInDollarString(total?.amount ?? 0)} / $
              {getCentsInDollarString(funding_goal?.amount ?? 0)}
            </span>
          </div>
        ))}
      </div>
    </main>
  )
}
