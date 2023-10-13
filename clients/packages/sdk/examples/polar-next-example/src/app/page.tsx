import { Issue, ListFundingSortBy, Platforms, PolarAPI } from '@polar-sh/sdk'

export async function getStaticProps() {
  const api = new PolarAPI()

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

  return { props: { issues } }
}

export default function Home(props: { issues: Issue[] }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 flex w-full max-w-5xl flex-col items-center justify-between font-mono text-sm">
        {props.issues.map((issue) => (
          <div
            className="flex flex-row items-center justify-between"
            key={issue.id}
          >
            <h4 className="text-md">{issue.title}</h4>
            <span className="text-sm">{issue.funding}</span>
          </div>
        ))}
      </div>
    </main>
  )
}
