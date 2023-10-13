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
        <h3 className="text-lg font-medium">Issues looking for funding</h3>
        {issues.items?.map(({ issue, funding_goal, total }) => (
          <div
            className="flex flex-row items-center justify-between py-2"
            key={issue.id}
          >
            <h4 className="text-md">{issue.title}</h4>
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
